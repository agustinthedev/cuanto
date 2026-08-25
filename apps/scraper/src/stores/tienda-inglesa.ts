import { extractJsonPrice, extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { htmlToText, requireResponseText } from "./base";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;|&#160;/gi, " ");
}

export function parseTiendaInglesaHtml(html: string): number {
  const normalizedHtml = decodeHtmlEntities(html);
  const prices = normalizedHtml.match(/"[^\"]+ProductUI_PARM"\s*:\s*\{[\s\S]*?"Prices"\s*:\s*\[([^\]]*)\]/i)?.[1];
  const originalPrice = prices?.match(/"Label"\s*:\s*"Antes[^\"]*"\s*,\s*"Price"\s*:\s*([\d.,]+)/i)?.[1];
  if (originalPrice) return extractJsonPrice(Number(originalPrice.replace(",", ".")));

  const regularPrice = prices?.match(/"Label"\s*:\s*"Precio[^\"]*"\s*,\s*"Price"\s*:\s*([\d.,]+)/i)?.[1];
  if (regularPrice) return extractJsonPrice(Number(regularPrice.replace(",", ".")));

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
