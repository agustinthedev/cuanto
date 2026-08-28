export class ScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScraperError";
  }
}

const RETRY_DELAYS_MS = [2_000, 5_000] as const;
const DEFAULT_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // A cleanup failure must not prevent the next retry attempt.
  }
}

function logRetry(input: RequestInfo | URL, attempt: number, nextAttempt: number, delayMs: number, status?: number, error?: unknown, response?: Response) {
  console.warn(JSON.stringify({
    event: "http_retry_scheduled",
    url: requestUrl(input),
    attempt,
    next_attempt: nextAttempt,
    delay_ms: delayMs,
    status: status ?? null,
    reason: error instanceof Error ? error.message : error ? String(error) : null,
    retry_after: response?.headers.get("Retry-After") ?? null,
    cf_ray: response?.headers.get("CF-Ray") ?? null,
  }));
}

export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = DEFAULT_ATTEMPTS): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || attempt === attempts) return response;

      await cancelResponseBody(response);
      lastError = new ScraperError(`Respuesta HTTP ${response.status}`);
      const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      logRetry(input, attempt, attempt + 1, delayMs, response.status, undefined, response);
      await sleep(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;

      const delayMs = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
      logRetry(input, attempt, attempt + 1, delayMs, undefined, error);
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new ScraperError("Error de red");
}

export async function requireResponseText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw new ScraperError(`No se pudo leer ${url}: HTTP ${response.status}`);
  return response.text();
}

export async function requireResponseJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchWithRetry(url, init);
  if (!response.ok) throw new ScraperError(`No se pudo leer ${url}: HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new ScraperError(`La respuesta de ${url} no es JSON válido`);
  }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function readAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function toHttpUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const decoded = decodeHtmlEntities(value).trim();
  if (!decoded || /^(?:data|blob):/i.test(decoded)) return undefined;

  try {
    const url = new URL(decoded, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const IMAGE_KEYS = new Set([
  "image",
  "images",
  "imageurl",
  "image_url",
  "imageurls",
  "image_urls",
  "thumbnail",
  "thumbnailurl",
  "thumbnail_url",
]);

function imageUrlFromValue(value: unknown, baseUrl: string, depth = 0): string | undefined {
  if (depth > 4 || value === null || value === undefined) return undefined;
  const directUrl = toHttpUrl(value, baseUrl);
  if (directUrl) return directUrl;
  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = imageUrlFromValue(item, baseUrl, depth + 1);
      if (imageUrl) return imageUrl;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["url", "src", "href"]) {
    const imageUrl = toHttpUrl(record[key], baseUrl);
    if (imageUrl) return imageUrl;
  }
  return undefined;
}

function isProductJsonLd(value: Record<string, unknown>): boolean {
  const type = value["@type"];
  return Array.isArray(type)
    ? type.some((item) => typeof item === "string" && item.toLowerCase() === "product")
    : typeof type === "string" && type.toLowerCase() === "product";
}

function findJsonLdImage(value: unknown, baseUrl: string, productContext = false, depth = 0): string | undefined {
  if (depth > 8 || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = findJsonLdImage(item, baseUrl, productContext, depth + 1);
      if (imageUrl) return imageUrl;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const currentProductContext = productContext || isProductJsonLd(record);
  if (currentProductContext) {
    for (const [key, child] of Object.entries(record)) {
      if (!IMAGE_KEYS.has(key.toLowerCase())) continue;
      const imageUrl = imageUrlFromValue(child, baseUrl);
      if (imageUrl) return imageUrl;
    }
  }

  for (const [key, child] of Object.entries(record)) {
    const childProductContext = currentProductContext || ["product", "products", "item", "itemlistelement", "@graph"].includes(key.toLowerCase());
    const imageUrl = findJsonLdImage(child, baseUrl, childProductContext, depth + 1);
    if (imageUrl) return imageUrl;
  }
  return undefined;
}

export function extractProductImageFromHtml(html: string, pageUrl: string): string | undefined {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const property = (readAttribute(tag, "property") ?? readAttribute(tag, "name"))?.toLowerCase();
    if (!property || !["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"].includes(property)) continue;
    const imageUrl = toHttpUrl(readAttribute(tag, "content"), pageUrl);
    if (imageUrl) return imageUrl;
  }

  const imagePropertyTags = html.match(/<[^>]*\bitemprop=["']image["'][^>]*>/gi) ?? [];
  for (const tag of imagePropertyTags) {
    const imageUrl = toHttpUrl(readAttribute(tag, "content") ?? readAttribute(tag, "src") ?? readAttribute(tag, "data-src"), pageUrl);
    if (imageUrl) return imageUrl;
  }

  const jsonLdScripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdScripts) {
    try {
      const payload = JSON.parse(decodeHtmlEntities(match[1])) as unknown;
      const imageUrl = findJsonLdImage(payload, pageUrl);
      if (imageUrl) return imageUrl;
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks and keep looking.
    }
  }

  return undefined;
}

export function extractProductImageFromPayload(payload: unknown, pageUrl: string): string | undefined {
  if (payload === null || typeof payload !== "object") return undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const imageUrl = extractProductImageFromPayload(item, pageUrl);
      if (imageUrl) return imageUrl;
    }
    return undefined;
  }

  const visit = (value: unknown, depth: number): string | undefined => {
    if (depth > 8 || value === null || typeof value !== "object") return undefined;
    if (Array.isArray(value)) {
      for (const item of value) {
        const imageUrl = visit(item, depth + 1);
        if (imageUrl) return imageUrl;
      }
      return undefined;
    }
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
      if (IMAGE_KEYS.has(key.toLowerCase())) {
        const imageUrl = imageUrlFromValue(child, pageUrl);
        if (imageUrl) return imageUrl;
      }
    }
    for (const child of Object.values(record)) {
      const imageUrl = visit(child, depth + 1);
      if (imageUrl) return imageUrl;
    }
    return undefined;
  };

  return visit(payload, 0);
}
