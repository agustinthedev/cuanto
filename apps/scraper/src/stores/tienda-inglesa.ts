import { extractJsonPrice, extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromHtml, fetchWithRetry, htmlToText, ScraperError } from "./base";

const DEFAULT_FALLBACK_ORIGIN = "https://prod-web-blue.tiendainglesa.com.uy";
const TIENDA_INGLESA_USER_AGENT = "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)";

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
  const originalPrice = prices?.match(/"Label"\s*:\s*"Antes[^\"]*"\s*,\s*"Price"\s*:\s*([\d]+(?:[.,]\d+)?)/i)?.[1];
  if (originalPrice) return extractJsonPrice(Number(originalPrice.replace(",", ".")));

  const regularPrice = prices?.match(/"Label"\s*:\s*"Precio[^\"]*"\s*,\s*"Price"\s*:\s*([\d]+(?:[.,]\d+)?)/i)?.[1];
  if (regularPrice) return extractJsonPrice(Number(regularPrice.replace(",", ".")));

  return extractPriceFromText(htmlToText(html));
}

function fallbackUrl(sourceUrl: string, fallbackOrigin: string): string {
  let source: URL;
  let fallback: URL;
  try {
    source = new URL(sourceUrl);
    fallback = new URL(fallbackOrigin);
  } catch {
    throw new ScraperError("La URL de Tienda Inglesa no es válida para usar el alias de scraping");
  }

  if (!/^https?:$/.test(fallback.protocol)) {
    throw new ScraperError("El alias de scraping de Tienda Inglesa debe usar HTTP o HTTPS");
  }

  source.protocol = fallback.protocol;
  source.host = fallback.host;
  return source.toString();
}

async function fetchTiendaInglesaHtml(record: StoreProductRecord, env: Env): Promise<string> {
  const init = { headers: { "User-Agent": TIENDA_INGLESA_USER_AGENT } };
  const response = await fetchWithRetry(record.url, init, undefined, (candidate) => candidate.status !== 403 && !candidate.ok);
  if (response.status !== 403) {
    if (!response.ok) throw new ScraperError(`No se pudo leer ${record.url}: HTTP ${response.status}`);
    return response.text();
  }

  await response.body?.cancel();
  const targetUrl = fallbackUrl(record.url, env.TIENDA_INGLESA_FALLBACK_ORIGIN ?? DEFAULT_FALLBACK_ORIGIN);
  if (targetUrl === record.url) throw new ScraperError(`El alias de Tienda Inglesa coincide con la URL original: ${record.url}`);

  console.warn(JSON.stringify({ event: "tienda_inglesa_fallback", source_url: record.url, target_url: targetUrl, status: 403 }));
  const fallbackResponse = await fetchWithRetry(targetUrl, init, undefined, (candidate) => candidate.status !== 403 && !candidate.ok);
  if (!fallbackResponse.ok) throw new ScraperError(`No se pudo leer el alias de Tienda Inglesa ${targetUrl}: HTTP ${fallbackResponse.status}`);
  return fallbackResponse.text();
}

export const tiendaInglesaScraper: StoreScraper = {
  slug: "tienda-inglesa",
  async scrape(record: StoreProductRecord, env): Promise<ScrapeResult> {
    const html = await fetchTiendaInglesaHtml(record, env);
    return { price: parseTiendaInglesaHtml(html), source: "html", imageUrl: extractProductImageFromHtml(html, record.url) };
  },
};
