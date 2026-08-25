import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { requireResponseJson } from "./base";

const TATA_CATALOG_API = "https://tatauy.myvtex.com/api/catalog_system/pub/products/search";

export function extractTataSlug(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "p") segments.pop();
  const slug = segments.at(-1);
  if (!slug) throw new Error("La URL de Ta-Ta no contiene un slug de producto");
  return decodeURIComponent(slug);
}

export function parseTataJson(payload: unknown): number {
  if (!Array.isArray(payload) || payload.length === 0) throw new Error("Ta-Ta no devolvió un producto");
  const prices: unknown[] = [];
  for (const product of payload) {
    if (!product || typeof product !== "object") continue;
    const items = (product as Record<string, unknown>).items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const sellers = (item as Record<string, unknown>).sellers;
      if (!Array.isArray(sellers)) continue;
      for (const seller of sellers) {
        if (!seller || typeof seller !== "object") continue;
        const offer = (seller as Record<string, unknown>).commertialOffer;
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        prices.push(offerRecord.ListPrice, offerRecord.Price);
      }
    }
  }
  return extractJsonPrice(...prices);
}

export const tataScraper: StoreScraper = {
  slug: "ta-ta",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const slug = extractTataSlug(record.url);
    const payload = await requireResponseJson(`${TATA_CATALOG_API}/${encodeURIComponent(slug)}/p`, { headers: { Accept: "application/json" } });
    return { price: parseTataJson(payload), source: "json" };
  },
};
