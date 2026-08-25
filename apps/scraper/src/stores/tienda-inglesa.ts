import { extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { htmlToText, requireResponseText } from "./base";

export function parseTiendaInglesaHtml(html: string): number {
  return extractPriceFromText(htmlToText(html));
}

export const tiendaInglesaScraper: StoreScraper = {
  slug: "tienda-inglesa",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const html = await requireResponseText(record.url, {
      headers: { "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)" },
    });
    return { price: parseTiendaInglesaHtml(html), source: "html" };
  },
};
