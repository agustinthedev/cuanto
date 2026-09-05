import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, fetchWithRetry, requireResponseJson, ScraperError } from "./base";

const TATA_HTML_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
};
const TATA_GRAPHQL_HEADERS = {
  Accept: "application/json",
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

function extractTataDataValue(html: string, testId: string): string | undefined {
  const element = html.match(new RegExp(`<[^>]*data-testid=["']${testId}["'][^>]*>`, "i"))?.[0];
  return element?.match(/data-value=["']([^"']+)["']/i)?.[1];
}

export function parseTataHtml(html: string): number {
  const listPrices: unknown[] = [extractTataDataValue(html, "list-price")];
  const regularPrices: unknown[] = [extractTataDataValue(html, "price")];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1]) as Record<string, unknown>;
      const offers = payload.offers;
      const offerList: unknown[] = offers && typeof offers === "object" && Array.isArray((offers as Record<string, unknown>).offers)
        ? (offers as Record<string, unknown>).offers as unknown[]
        : offers && typeof offers === "object" ? [offers] : [];

      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        listPrices.push(offerRecord.listPrice);
        regularPrices.push(offerRecord.price);
      }
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks and keep looking.
    }
  }

  if (listPrices.some((value) => value !== undefined && value !== null && value !== "")) return extractJsonPrice(...listPrices);
  return extractJsonPrice(...regularPrices);
}

async function fetchTataMontevideoSession(rawUrl: string): Promise<void> {
  const payload = await requireResponseJson(tataGraphqlUrl(rawUrl, "ValidateSession", {
    session: TATA_MONTEVIDEO_SESSION,
    search: "",
  }), { headers: TATA_GRAPHQL_HEADERS });
  const session = asRecord(asRecord(payload)?.data)?.validateSession;
  const sessionRecord = asRecord(session);

  if (
    sessionRecord?.country !== TATA_MONTEVIDEO_COUNTRY
    || sessionRecord.postalCode !== TATA_MONTEVIDEO_POSTAL_CODE
    || typeof sessionRecord.channel !== "string"
    || typeof sessionRecord.locale !== "string"
  ) {
    throw new ScraperError("Ta-Ta no confirmó el contexto de Montevideo y Ciudad de la Costa");
  }
}

async function fetchTataHtml(rawUrl: string): Promise<string> {
  const response = await fetchWithRetry(
    tataLocalityUrl(rawUrl),
    { headers: TATA_HTML_HEADERS },
    undefined,
    (candidate) => candidate.status === 429 || candidate.status >= 500,
  );
  if (!response.ok) throw new ScraperError(`No se pudo leer ${rawUrl}: HTTP ${response.status}`);
  return response.text();
}

export const tataScraper: StoreScraper = {
  slug: "ta-ta",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    extractTataSlug(record.url);
    await fetchTataMontevideoSession(record.url);
    const html = await fetchTataHtml(record.url);
    return { price: parseTataHtml(html), source: "html", imageUrl: extractProductImageFromHtml(html, record.url) };
  },
};
