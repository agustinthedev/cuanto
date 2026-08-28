import { extractJsonPrice, extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, htmlToText, requireResponseText } from "./base";

function metaContent(html: string, property: string): string | undefined {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = metaTags.find((candidate) => {
    const value = candidate.match(/\bproperty\s*=\s*(["'])(.*?)\1/i)?.[2];
    return value?.toLowerCase() === property.toLowerCase();
  });
  return tag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
}

export function parseDiscoHtml(html: string): number {
  const originalPriceBlock = html.match(
    /<(div|span)\b[^>]*class=["'][^"']*\bbefore\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/i,
  )?.[0];

  if (originalPriceBlock) return extractPriceFromText(htmlToText(originalPriceBlock));

  const originalPrice = metaContent(html, "product:price:amount");
  if (originalPrice) return extractJsonPrice(Number(originalPrice));

  throw new Error("Disco no incluyó un precio original identificable");
}

export const discoScraper: StoreScraper = {
  slug: "disco",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const html = await requireResponseText(record.url, {
      headers: { "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)" },
    });
    return { price: parseDiscoHtml(html), source: "html", imageUrl: extractProductImageFromHtml(html, record.url) };
  },
};
