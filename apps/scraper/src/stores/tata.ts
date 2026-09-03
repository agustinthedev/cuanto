import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, fetchWithRetry, ScraperError } from "./base";

const TATA_HTML_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
};

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

async function fetchTataHtml(rawUrl: string): Promise<string> {
  const response = await fetchWithRetry(
    rawUrl,
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
    const html = await fetchTataHtml(record.url);
    return { price: parseTataHtml(html), source: "html", imageUrl: extractProductImageFromHtml(html, record.url) };
  },
};
