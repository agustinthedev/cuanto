import { supabase } from "../lib/supabase";

export const ANON_ID_STORAGE_KEY = "cuanto_anon_id";
export const SESSION_ID_STORAGE_KEY = "cuanto_session_id";
export const SESSION_LAST_ACTIVITY_STORAGE_KEY = "cuanto_session_last_activity";
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

export type AnalyticsEventType = "page_view" | "search";
export type AnalyticsPageType = "home" | "search" | "product" | "other";
export type AnalyticsReferrerType = "direct" | "external" | "internal";

export interface AnalyticsIdentity {
  anonId: string;
  sessionId: string;
}

export interface AnalyticsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PageViewReferrer {
  referrer: string | null;
  referrerPath: string | null;
  referrerType: AnalyticsReferrerType;
  referrerProductId?: string;
}

export interface TrackPageViewInput {
  path?: string;
  pageType: AnalyticsPageType;
  productId?: string;
  referrer?: PageViewReferrer;
  dedupeKey?: string;
}

export interface TrackSearchInput {
  query: string;
  resultCount: number;
  resultProductIds: string[];
  path?: string;
}

let cachedIdentity: AnalyticsIdentity | null = null;
const trackedPageViewKeys = new Set<string>();

function browserStorage(): AnalyticsStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function browserUuid(): string {
  const browserCrypto = typeof globalThis.crypto === "undefined" ? null : globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function hasValue(value: string | null): value is string {
  return Boolean(value?.trim());
}

function readTimestamp(storage: AnalyticsStorage): number | null {
  const raw = storage.getItem(SESSION_LAST_ACTIVITY_STORAGE_KEY);
  if (!raw) return null;
  const timestamp = Number(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getOrCreateAnalyticsIdentity(options: {
  storage?: AnalyticsStorage | null;
  now?: number;
  uuid?: () => string;
} = {}): AnalyticsIdentity {
  if (cachedIdentity) return cachedIdentity;

  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? Date.now();
  const uuid = options.uuid ?? browserUuid;
  const storedAnonId = storage?.getItem(ANON_ID_STORAGE_KEY) ?? null;
  const anonId = hasValue(storedAnonId) ? storedAnonId : uuid();
  if (!storedAnonId) storage?.setItem(ANON_ID_STORAGE_KEY, anonId);

  const storedSessionId = storage?.getItem(SESSION_ID_STORAGE_KEY) ?? null;
  const lastActivity = storage ? readTimestamp(storage) : null;
  const sessionIsExpired = lastActivity !== null && now - lastActivity > SESSION_INACTIVITY_MS;
  const sessionId = !hasValue(storedSessionId) || sessionIsExpired ? uuid() : storedSessionId;

  if (!hasValue(storedSessionId) || sessionIsExpired) storage?.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  if (!lastActivity || sessionIsExpired) storage?.setItem(SESSION_LAST_ACTIVITY_STORAGE_KEY, String(now));

  cachedIdentity = { anonId, sessionId };
  return cachedIdentity;
}

export function resetAnalyticsStateForTests() {
  cachedIdentity = null;
  trackedPageViewKeys.clear();
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-UY");
}

export function getPageType(pathname: string): AnalyticsPageType {
  if (pathname === "/") return "home";
  if (pathname === "/productos") return "search";
  if (/^\/productos\/[^/]+$/.test(pathname)) return "product";
  return "other";
}

export function getProductIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/productos\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function getLocationPath(location: Pick<Location, "pathname" | "search">): string {
  return `${location.pathname}${location.search}`;
}

export function getPageViewReferrer(previousPath: string | null, documentReferrer = "", origin = ""): PageViewReferrer {
  if (previousPath) {
    return {
      referrer: previousPath,
      referrerPath: previousPath,
      referrerType: "internal",
      ...(getProductIdFromPath(previousPath.split("?")[0]) ? { referrerProductId: getProductIdFromPath(previousPath.split("?")[0]) } : {}),
    };
  }

  if (!documentReferrer) return { referrer: null, referrerPath: null, referrerType: "direct" };

  try {
    const parsed = new URL(documentReferrer);
    const referrerPath = `${parsed.pathname}${parsed.search}`;
    if (origin && parsed.origin === origin) {
      return {
        referrer: documentReferrer,
        referrerPath,
        referrerType: "internal",
        ...(getProductIdFromPath(parsed.pathname) ? { referrerProductId: getProductIdFromPath(parsed.pathname) } : {}),
      };
    }
    return { referrer: documentReferrer, referrerPath, referrerType: "external" };
  } catch {
    return { referrer: documentReferrer, referrerPath: null, referrerType: "external" };
  }
}

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return getLocationPath(window.location);
}

function safeTrackError(eventType: AnalyticsEventType, reason: unknown) {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[analytics] No se pudo guardar el evento ${eventType}.`, reason);
  }
}

export async function trackEvent(input: {
  eventType: AnalyticsEventType;
  path?: string;
  referrer?: PageViewReferrer;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    const identity = getOrCreateAnalyticsIdentity();
    const referrer = input.referrer ?? { referrer: null, referrerPath: null, referrerType: "direct" as const };
    const storage = browserStorage();
    storage?.setItem(SESSION_LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    if (!supabase) return;

    const { error } = await supabase.from("analytics_events").insert({
      anon_id: identity.anonId,
      session_id: identity.sessionId,
      event_type: input.eventType,
      path: input.path ?? currentPath(),
      referrer: referrer.referrer,
      referrer_path: referrer.referrerPath,
      referrer_type: referrer.referrerType,
      metadata: input.metadata,
    });
    if (error) safeTrackError(input.eventType, error);
  } catch (reason) {
    safeTrackError(input.eventType, reason);
  }
}

export async function trackPageView(input: TrackPageViewInput): Promise<void> {
  if (input.dedupeKey && trackedPageViewKeys.has(input.dedupeKey)) return;
  if (input.dedupeKey) {
    trackedPageViewKeys.add(input.dedupeKey);
    if (trackedPageViewKeys.size > 100) trackedPageViewKeys.delete(trackedPageViewKeys.values().next().value as string);
  }

  const metadata: Record<string, unknown> = { page_type: input.pageType };
  if (input.productId) metadata.product_id = input.productId;
  if (input.referrer?.referrerProductId && input.pageType === "product") metadata.referrer_product_id = input.referrer.referrerProductId;

  await trackEvent({
    eventType: "page_view",
    path: input.path,
    referrer: input.referrer,
    metadata,
  });
}

export async function trackSearch(input: TrackSearchInput): Promise<void> {
  const query = input.query.trim();
  const resultCount = Number.isFinite(input.resultCount) ? Math.max(0, Math.floor(input.resultCount)) : 0;
  const resultProductIds = input.resultProductIds.filter((productId) => Boolean(productId)).slice(0, 1000);
  await trackEvent({
    eventType: "search",
    path: input.path,
    metadata: {
      query,
      normalized_query: normalizeSearchQuery(query),
      result_count: resultCount,
      result_product_ids: resultProductIds,
    },
  });
}
