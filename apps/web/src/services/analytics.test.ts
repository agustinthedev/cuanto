import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("../lib/supabase", () => ({ supabase: { rpc: mockRpc } }));

import {
  ANON_ID_STORAGE_KEY,
  SESSION_ID_STORAGE_KEY,
  SESSION_INACTIVITY_MS,
  SESSION_LAST_ACTIVITY_STORAGE_KEY,
  getOrCreateAnalyticsIdentity,
  buildPageViewMetadata,
  buildSearchMetadata,
  buildEmailCaptureMetadata,
  buildAnalyticsClientContext,
  serializeAnalyticsClientContext,
  trackEvent,
  getPageViewReferrer,
  getProductIdFromPath,
  normalizeSearchQuery,
  registerUniqueProductPageView,
  resetAnalyticsStateForTests,
} from "./analytics";

beforeEach(() => {
  mockRpc.mockReset();
});

class MemoryStorage {
  private values: Map<string, string>;

  constructor(initialValues: Record<string, string> = {}) {
    this.values = new Map(Object.entries(initialValues));
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class ReadableButWriteFailingStorage extends MemoryStorage {
  setItem() {
    throw new Error("storage is read-only");
  }
}

const anonId = "11111111-1111-4111-8111-111111111111";
const firstSessionId = "22222222-2222-4222-8222-222222222222";
const secondSessionId = "33333333-3333-4333-8333-333333333333";

describe("analytics identity", () => {
  it("creates and then reuses an anonymous ID", () => {
    const storage = new MemoryStorage();
    resetAnalyticsStateForTests();

    const first = getOrCreateAnalyticsIdentity({ storage, now: 1000, uuid: () => anonId });
    resetAnalyticsStateForTests();
    const second = getOrCreateAnalyticsIdentity({ storage, now: 2000, uuid: () => firstSessionId });

    expect(first.anonId).toBe(anonId);
    expect(second.anonId).toBe(anonId);
    expect(storage.getItem(ANON_ID_STORAGE_KEY)).toBe(anonId);
  });

  it("creates a session, retains it during activity, and rotates it after inactivity", () => {
    const storage = new MemoryStorage();
    resetAnalyticsStateForTests();

    const first = getOrCreateAnalyticsIdentity({ storage, now: 1000, uuid: () => firstSessionId });
    resetAnalyticsStateForTests();
    const active = getOrCreateAnalyticsIdentity({ storage, now: 1000 + SESSION_INACTIVITY_MS, uuid: () => secondSessionId });
    resetAnalyticsStateForTests();
    const expired = getOrCreateAnalyticsIdentity({ storage, now: 1000 + SESSION_INACTIVITY_MS + 1, uuid: () => secondSessionId });

    expect(first.sessionId).toBe(firstSessionId);
    expect(active.sessionId).toBe(firstSessionId);
    expect(expired.sessionId).toBe(secondSessionId);
    expect(storage.getItem(SESSION_ID_STORAGE_KEY)).toBe(secondSessionId);
    expect(storage.getItem(SESSION_LAST_ACTIVITY_STORAGE_KEY)).toBe(String(1000 + SESSION_INACTIVITY_MS + 1));
  });

  it("rotates a cached session after inactivity without a page reload", () => {
    const storage = new MemoryStorage();
    resetAnalyticsStateForTests();

    const first = getOrCreateAnalyticsIdentity({ storage, now: 1000, uuid: () => firstSessionId });
    const expired = getOrCreateAnalyticsIdentity({
      storage,
      now: 1000 + SESSION_INACTIVITY_MS + 1,
      uuid: () => secondSessionId,
    });

    expect(first.sessionId).toBe(firstSessionId);
    expect(expired.sessionId).toBe(secondSessionId);
    expect(storage.getItem(SESSION_LAST_ACTIVITY_STORAGE_KEY)).toBe(String(1000 + SESSION_INACTIVITY_MS + 1));
  });

  it("refreshes a cached identity when another tab rotates the shared session", () => {
    const storage = new MemoryStorage();
    resetAnalyticsStateForTests();

    const first = getOrCreateAnalyticsIdentity({ storage, now: 1000, uuid: () => firstSessionId });
    storage.setItem(SESSION_ID_STORAGE_KEY, secondSessionId);
    storage.setItem(SESSION_LAST_ACTIVITY_STORAGE_KEY, String(2000));

    const refreshed = getOrCreateAnalyticsIdentity({ storage, now: 2000, uuid: () => firstSessionId });

    expect(first.sessionId).toBe(firstSessionId);
    expect(refreshed.sessionId).toBe(secondSessionId);
  });
});

describe("analytics referrers and query normalization", () => {
  it("represents direct, external, and internal product navigation", () => {
    expect(getPageViewReferrer(null)).toEqual({ referrer: null, referrerPath: null, referrerType: "direct" });
    expect(getPageViewReferrer(null, "https://www.google.com/search?q=cuanto", "https://cuanto.uy")).toMatchObject({
      referrer: "https://www.google.com/search?q=cuanto",
      referrerPath: "/search?q=cuanto",
      referrerType: "external",
    });
    expect(getPageViewReferrer("/productos/44444444-4444-4444-8444-444444444444", "", "https://cuanto.uy")).toMatchObject({
      referrer: "/productos/44444444-4444-4444-8444-444444444444",
      referrerPath: "/productos/44444444-4444-4444-8444-444444444444",
      referrerType: "internal",
      referrerProductId: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("ignores product paths with malformed percent escapes", () => {
    expect(getProductIdFromPath("/productos/%")).toBeUndefined();
  });

  it("normalizes whitespace and casing for aggregation", () => {
    expect(normalizeSearchQuery("  Coca   Cola ")).toBe("coca cola");
  });

  it("derives bounded browser context without storing the raw user agent", () => {
    const context = buildAnalyticsClientContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      language: "es-UY",
      timezone: "America/Montevideo",
      viewportWidth: 1440.8,
      viewportHeight: 900.9,
    });
    expect(context).toEqual({
      browserFamily: "Chrome",
      browserVersion: "140.0.0.0",
      osFamily: "Windows",
      osVersion: "10.0",
      deviceType: "desktop",
      locale: "es-UY",
      timezone: "America/Montevideo",
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    const payload = serializeAnalyticsClientContext(context);
    expect(payload).toEqual({
      browser_family: "Chrome",
      browser_version: "140.0.0.0",
      os_family: "Windows",
      os_version: "10.0",
      device_type: "desktop",
      locale: "es-UY",
      timezone: "America/Montevideo",
      viewport_width: 1440,
      viewport_height: 900,
    });
    expect(payload).not.toHaveProperty("country_code");
  });

  it("classifies mobile Safari and tablet devices", () => {
    expect(buildAnalyticsClientContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1",
    })).toMatchObject({ browserFamily: "Safari", osFamily: "iOS", osVersion: "17.5", deviceType: "mobile" });
    expect(buildAnalyticsClientContext({
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1",
    })).toMatchObject({ deviceType: "tablet" });
  });

  it("builds structured page and search metadata", () => {
    expect(buildPageViewMetadata({
      pageType: "product",
      productId: "55555555-5555-4555-8555-555555555555",
      referrer: { referrer: "/productos/44444444-4444-4444-8444-444444444444", referrerPath: "/productos/44444444-4444-4444-8444-444444444444", referrerType: "internal", referrerProductId: "44444444-4444-4444-8444-444444444444" },
    })).toEqual({
      page_type: "product",
      product_id: "55555555-5555-4555-8555-555555555555",
      referrer_product_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(buildSearchMetadata({ query: "  Coca   Cola ", resultCount: 2.9, resultProductIds: ["product-a", ""] })).toEqual({
      query: "Coca   Cola",
      normalized_query: "coca cola",
      result_count: 2,
      result_product_ids: ["product-a"],
    });
  });

  it("counts unique product pages within a session and prompts on the third one", () => {
    const storage = new MemoryStorage();
    storage.setItem(ANON_ID_STORAGE_KEY, anonId);
    storage.setItem(SESSION_ID_STORAGE_KEY, firstSessionId);
    storage.setItem(SESSION_LAST_ACTIVITY_STORAGE_KEY, "1000");
    resetAnalyticsStateForTests();

    const productIds = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    expect(registerUniqueProductPageView(productIds[0], { storage, now: 2000 })).toMatchObject({ uniqueProductCount: 1, isNewProduct: true, shouldPrompt: false });
    expect(registerUniqueProductPageView(productIds[1], { storage, now: 3000 })).toMatchObject({ uniqueProductCount: 2, isNewProduct: true, shouldPrompt: false });
    expect(registerUniqueProductPageView(productIds[0], { storage, now: 4000 })).toMatchObject({ uniqueProductCount: 2, isNewProduct: false, shouldPrompt: false });
    expect(registerUniqueProductPageView(productIds[2], { storage, now: 5000 })).toMatchObject({ uniqueProductCount: 3, isNewProduct: true, shouldPrompt: true });
    expect(registerUniqueProductPageView("77777777-7777-4777-8777-777777777777", { storage, now: 6000 })).toMatchObject({ uniqueProductCount: 4, isNewProduct: true, shouldPrompt: false });
  });

  it("keeps counting unique product pages in memory when storage writes fail", () => {
    const storage = new ReadableButWriteFailingStorage({
      [ANON_ID_STORAGE_KEY]: anonId,
      [SESSION_ID_STORAGE_KEY]: firstSessionId,
      [SESSION_LAST_ACTIVITY_STORAGE_KEY]: "1000",
    });
    resetAnalyticsStateForTests();

    const productIds = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
      "66666666-6666-4666-8666-666666666666",
    ];
    expect(registerUniqueProductPageView(productIds[0], { storage, now: 2000 })).toMatchObject({ uniqueProductCount: 1, shouldPrompt: false });
    expect(registerUniqueProductPageView(productIds[1], { storage, now: 3000 })).toMatchObject({ uniqueProductCount: 2, shouldPrompt: false });
    expect(registerUniqueProductPageView(productIds[2], { storage, now: 4000 })).toMatchObject({ uniqueProductCount: 3, shouldPrompt: true });
    expect(registerUniqueProductPageView("77777777-7777-4777-8777-777777777777", { storage, now: 5000 })).toMatchObject({ uniqueProductCount: 4, shouldPrompt: false });
  });

  it("builds email capture metadata without including the email", () => {
    expect(buildEmailCaptureMetadata({ productId: "44444444-4444-4444-8444-444444444444", uniqueProductCount: 3 })).toEqual({
      prompt: "third_product_page",
      product_id: "44444444-4444-4444-8444-444444444444",
      unique_product_count: 3,
    });
  });
});

describe("analytics event persistence", () => {
  it("uses the transactional event RPC for event and context persistence", async () => {
    mockRpc.mockResolvedValue({ error: null });
    resetAnalyticsStateForTests();

    await trackEvent({
      eventType: "page_view",
      path: "/",
      metadata: { page_type: "home" },
    });

    expect(mockRpc).toHaveBeenCalledWith("record_analytics_event", expect.objectContaining({
      p_event_type: "page_view",
      p_path: "/",
      p_metadata: { page_type: "home" },
      p_context: expect.objectContaining({ device_type: expect.any(String) }),
    }));
  });
});
