import { extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { htmlToText, requireResponseText } from "./base";

export function parseDiscoHtml(html: string): number {
  return extractPriceFromText(htmlToText(html));
}

export const discoScraper: StoreScraper = {
  slug: "disco",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const html = await requireResponseText(record.url, {
      headers: { "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)" },
    });
    return { price: parseDiscoHtml(html), source: "html" };
  },
};
