import { selectPriceCandidate } from "../price";
import type { PriceEvidence, ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, extractProductImageFromPayload, fetchWithRetry, readResponseSnapshot, requireResponseTextSnapshot, scraperErrorWithResponse, ScraperError } from "./base";

const TATA_HTML_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
};
const TATA_GRAPHQL_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": TATA_HTML_HEADERS["User-Agent"],
};
const TATA_MONTEVIDEO_SESSION = {
  currency: { code: "UYU", symbol: "$" },
  locale: "es-UY",
  channel: JSON.stringify({ salesChannel: "4", regionId: "" }),
  country: "URY",
  postalCode: "11800",
  person: null,
};
const TATA_MONTEVIDEO_COUNTRY = "URY";
const TATA_MONTEVIDEO_POSTAL_CODE = "11800";

type JsonRecord = Record<string, unknown>;
type TataSession = { channel: string; locale: string };

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function tataGraphqlUrl(rawUrl: string, operationName: string, variables: unknown): string {
  const url = new URL("/api/graphql", rawUrl);
  url.searchParams.set("operationName", operationName);
  url.searchParams.set("variables", JSON.stringify(variables));
  return url.toString();
}

function tataLocalityUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.set("country", TATA_MONTEVIDEO_COUNTRY);
  url.searchParams.set("postalCode", TATA_MONTEVIDEO_POSTAL_CODE);
  return url.toString();
}

export function extractTataSlug(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "p") segments.pop();
  const slug = segments.at(-1);
  if (!slug) throw new Error("La URL de Ta-Ta no contiene un slug de producto");
  return decodeURIComponent(slug);
}

function tataOffers(payload: unknown): unknown[] {
  const product = asRecord(asRecord(payload)?.data)?.product;
  const offers = asRecord(asRecord(product)?.offers)?.offers;
  return Array.isArray(offers) ? offers : [];
}

export function parseTataProductPayloadWithEvidence(payload: unknown): PriceEvidence & { price: number } {
  const listPrices: Array<{ path: string; value: unknown }> = [];
  const regularPrices: Array<{ path: string; value: unknown }> = [];

  for (const [offerIndex, offer] of tataOffers(payload).entries()) {
    const offerRecord = asRecord(offer);
    if (!offerRecord) continue;
    if (offerRecord.listPrice !== undefined) {
      listPrices.push({ path: `data.product.offers.offers[${offerIndex}].listPrice`, value: offerRecord.listPrice });
    }
    if (offerRecord.price !== undefined) {
      regularPrices.push({ path: `data.product.offers.offers[${offerIndex}].price`, value: offerRecord.price });
    }
  }

  if (listPrices.length > 0) return selectPriceCandidate(listPrices);
  return selectPriceCandidate(regularPrices);
}

function extractTataDataValue(html: string, testId: string): string | undefined {
  const element = html.match(new RegExp(`<[^>]*data-testid=["']${testId}["'][^>]*>`, "i"))?.[0];
  return element?.match(/data-value=["']([^"']+)["']/i)?.[1];
}

export function parseTataHtml(html: string): number {
  return parseTataHtmlWithEvidence(html).price;
}

export function parseTataHtmlWithEvidence(html: string): PriceEvidence & { price: number } {
  const listPrices: Array<{ path: string; value: unknown }> = [];
  const regularPrices: Array<{ path: string; value: unknown }> = [];
  const htmlListPrice = extractTataDataValue(html, "list-price");
  const htmlRegularPrice = extractTataDataValue(html, "price");
  if (htmlListPrice !== undefined) listPrices.push({ path: 'html[data-testid="list-price"]', value: htmlListPrice });
  if (htmlRegularPrice !== undefined) regularPrices.push({ path: 'html[data-testid="price"]', value: htmlRegularPrice });
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  let scriptIndex = 0;

  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1]) as Record<string, unknown>;
      const offers = payload.offers;
      const offerList: unknown[] = offers && typeof offers === "object" && Array.isArray((offers as Record<string, unknown>).offers)
        ? (offers as Record<string, unknown>).offers as unknown[]
        : offers && typeof offers === "object" ? [offers] : [];

      for (const [offerIndex, offer] of offerList.entries()) {
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        if (offerRecord.listPrice !== undefined) {
          listPrices.push({ path: `json-ld[${scriptIndex}].offers.offers[${offerIndex}].listPrice`, value: offerRecord.listPrice });
        }
        if (offerRecord.price !== undefined) {
          regularPrices.push({ path: `json-ld[${scriptIndex}].offers.offers[${offerIndex}].price`, value: offerRecord.price });
        }
      }
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks and keep looking.
    }
    scriptIndex += 1;
  }

  if (listPrices.length > 0) return selectPriceCandidate(listPrices);
  return selectPriceCandidate(regularPrices);
}

async function fetchTataMontevideoSession(rawUrl: string): Promise<TataSession> {
  const response = await fetchWithRetry(tataGraphqlUrl(rawUrl, "ValidateSession", {
    session: TATA_MONTEVIDEO_SESSION,
    search: "",
  }), { headers: TATA_GRAPHQL_HEADERS });
  const payload = await response.json();
  const session = asRecord(asRecord(payload)?.data)?.validateSession;
  const sessionRecord = asRecord(session);
  const channel = sessionRecord?.channel;
  const locale = sessionRecord?.locale;
  let channelRecord: JsonRecord | null = null;
  if (typeof channel === "string") {
    try {
      channelRecord = asRecord(JSON.parse(channel));
    } catch {
      channelRecord = null;
    }
  }

  if (
    sessionRecord?.country !== TATA_MONTEVIDEO_COUNTRY
    || sessionRecord.postalCode !== TATA_MONTEVIDEO_POSTAL_CODE
    || typeof channel !== "string"
    || typeof locale !== "string"
    || typeof channelRecord?.regionId !== "string"
    || channelRecord.regionId.length === 0
  ) {
    throw new ScraperError("Ta-Ta no confirmó el contexto de Montevideo y Ciudad de la Costa");
  }

  return { channel, locale };
}

async function fetchTataProduct(rawUrl: string, session: TataSession) {
  const url = tataGraphqlUrl(rawUrl, "BrowserProductQuery", {
    locator: [
      { key: "slug", value: extractTataSlug(rawUrl) },
      { key: "channel", value: session.channel },
      { key: "locale", value: session.locale },
    ],
  });
  const response = await fetchWithRetry(url, { headers: TATA_GRAPHQL_HEADERS });
  const rawResponse = await readResponseSnapshot(response, url);
  if (!response.ok) throw new ScraperError(`No se pudo leer el producto de Ta-Ta: HTTP ${response.status}`, rawResponse, "json");
  let payload: unknown;
  try {
    payload = JSON.parse(rawResponse.body);
  } catch {
    throw new ScraperError("La respuesta del producto de Ta-Ta no es JSON válido", rawResponse, "json");
  }
  return { payload, rawResponse };
}

async function fetchTataHtml(rawUrl: string) {
  const url = tataLocalityUrl(rawUrl);
  return requireResponseTextSnapshot(
    url,
    { headers: TATA_HTML_HEADERS },
    (candidate) => candidate.status === 429 || candidate.status >= 500,
  );
}

export const tataScraper: StoreScraper = {
  slug: "ta-ta",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const session = await fetchTataMontevideoSession(record.url);
    try {
      const { payload, rawResponse } = await fetchTataProduct(record.url, session);
      try {
        const { price, ...evidence } = parseTataProductPayloadWithEvidence(payload);
        return { price, source: "json", evidence, rawResponse, imageUrl: extractProductImageFromPayload(payload, record.url) };
      } catch (error) {
        throw scraperErrorWithResponse(error, rawResponse, "json");
      }
    } catch (error) {
      if (!(error instanceof ScraperError) || error.rawResponse?.status === undefined || error.rawResponse.status < 500) {
        throw error;
      }

      const rawResponse = await fetchTataHtml(record.url);
      try {
        const { price, ...evidence } = parseTataHtmlWithEvidence(rawResponse.body);
        return { price, source: "html", evidence, rawResponse, imageUrl: extractProductImageFromHtml(rawResponse.body, record.url) };
      } catch (fallbackError) {
        throw scraperErrorWithResponse(fallbackError, rawResponse, "html");
      }
    }
  },
};
