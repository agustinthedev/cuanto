import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { requireResponseText } from "./base";

export function extractTataSlug(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "p") segments.pop();
  const slug = segments.at(-1);
  if (!slug) throw new Error("La URL de Ta-Ta no contiene un slug de producto");
  return decodeURIComponent(slug);
}

export function parseTataHtml(html: string): number {
  const prices: unknown[] = [];
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
        prices.push(offerRecord.listPrice, offerRecord.price);
      }
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks and keep looking.
    }
  }

  if (prices.length === 0) throw new Error("Ta-Ta no incluyó el precio en el HTML");
  return extractJsonPrice(...prices);
}

export const tataScraper: StoreScraper = {
  slug: "ta-ta",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    extractTataSlug(record.url);
    const html = await requireResponseText(record.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
      },
    });
    return { price: parseTataHtml(html), source: "html" };
  },
};
