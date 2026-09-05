import { describe, expect, it } from "vitest";
import {
  ANON_ID_STORAGE_KEY,
  SESSION_ID_STORAGE_KEY,
  SESSION_INACTIVITY_MS,
  SESSION_LAST_ACTIVITY_STORAGE_KEY,
  getOrCreateAnalyticsIdentity,
  buildPageViewMetadata,
  buildSearchMetadata,
  getPageViewReferrer,
  getProductIdFromPath,
  normalizeSearchQuery,
  resetAnalyticsStateForTests,
} from "./analytics";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
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
});
