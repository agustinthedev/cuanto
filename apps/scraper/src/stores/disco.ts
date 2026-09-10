import { extractPriceCandidatesFromText, selectPriceCandidate } from "../price";
import type { PriceEvidence, ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, htmlToText, requireResponseTextSnapshot } from "./base";

function metaContent(html: string, property: string): string | undefined {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = metaTags.find((candidate) => {
    const value = candidate.match(/\bproperty\s*=\s*(["'])(.*?)\1/i)?.[2];
    return value?.toLowerCase() === property.toLowerCase();
  });
  return tag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
}

export function parseDiscoHtml(html: string): number {
  return parseDiscoHtmlWithEvidence(html).price;
}

export function parseDiscoHtmlWithEvidence(html: string): PriceEvidence & { price: number } {
  const originalPriceBlock = html.match(
    /<(div|span)\b[^>]*class=["'][^"']*\bbefore\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/i,
  )?.[0];

  if (originalPriceBlock) {
    const prices = extractPriceCandidatesFromText(htmlToText(originalPriceBlock));
    const candidates = prices.map((value, index) => ({ path: `html.class~before.currency[${index}]`, value }));
    const selected = candidates.at(-1);
    if (!selected) throw new Error("Disco no incluyó un precio original identificable");
    return { price: selected.value, selectedPath: selected.path, candidates };
  }

  const originalPrice = metaContent(html, "product:price:amount");
  if (originalPrice) return selectPriceCandidate([{ path: 'meta[property="product:price:amount"]', value: Number(originalPrice) }]);

  throw new Error("Disco no incluyó un precio original identificable");
}

export const discoScraper: StoreScraper = {
  slug: "disco",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const rawResponse = await requireResponseTextSnapshot(record.url, {
      headers: { "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)" },
    });
    const parsed = parseDiscoHtmlWithEvidence(rawResponse.body);
    const { price, ...evidence } = parsed;
    return { price, source: "html", evidence, rawResponse, imageUrl: extractProductImageFromHtml(rawResponse.body, record.url) };
  },
};
