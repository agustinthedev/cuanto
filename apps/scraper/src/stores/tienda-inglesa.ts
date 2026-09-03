import { extractJsonPrice, extractPriceFromText } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScrapeContext, StoreScraper } from "../types";
import { extractProductImageFromHtml, fetchWithRetry, htmlToText, ScraperError } from "./base";

const DEFAULT_FALLBACK_ORIGINS = [
  "https://prod-web-blue.tiendainglesa.com.uy",
  "https://prod-web-green.tiendainglesa.com.uy",
] as const;
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

function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins.map((origin) => origin.trim()).filter(Boolean))];
}

export function tiendaInglesaFallbackOrigins(env: Env): string[] {
  return uniqueOrigins([
    env.TIENDA_INGLESA_FALLBACK_ORIGIN ?? "",
    ...DEFAULT_FALLBACK_ORIGINS,
  ]);
}

export function fallbackUrl(sourceUrl: string, fallbackOrigin: string): string {
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

function hasTiendaInglesaProductData(html: string): boolean {
  return /"[^\"]+ProductUI_PARM"\s*:\s*\{/i.test(decodeHtmlEntities(html));
}

function orderedFallbackOrigins(env: Env, preferredOrigins?: string[]): string[] {
  return uniqueOrigins([...(preferredOrigins ?? []), ...tiendaInglesaFallbackOrigins(env)]);
}

export async function probeTiendaInglesaFallbackOrigin(record: StoreProductRecord, fallbackOrigin: string): Promise<boolean> {
  let targetUrl: string;
  try {
    targetUrl = fallbackUrl(record.url, fallbackOrigin);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "tienda_inglesa_alias_probe_failed",
      origin: fallbackOrigin,
      source_url: record.url,
      reason: error instanceof Error ? error.message : String(error),
    }));
    return false;
  }

  try {
    const response = await fetch(targetUrl, { headers: { "User-Agent": TIENDA_INGLESA_USER_AGENT } });
    if (!response.ok) {
      await response.body?.cancel();
      console.warn(JSON.stringify({ event: "tienda_inglesa_alias_probe_failed", origin: fallbackOrigin, target_url: targetUrl, status: response.status }));
      return false;
    }

    const html = await response.text();
    const healthy = hasTiendaInglesaProductData(html);
    if (!healthy) {
      console.warn(JSON.stringify({ event: "tienda_inglesa_alias_probe_failed", origin: fallbackOrigin, target_url: targetUrl, status: response.status, reason: "missing_product_data" }));
    }
    return healthy;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "tienda_inglesa_alias_probe_failed",
      origin: fallbackOrigin,
      target_url: targetUrl,
      reason: error instanceof Error ? error.message : String(error),
    }));
    return false;
  }
}

async function fetchFromFallbackOrigins(record: StoreProductRecord, env: Env, preferredOrigins?: string[]): Promise<string> {
  const init = { headers: { "User-Agent": TIENDA_INGLESA_USER_AGENT } };
  const failedOrigins: string[] = [];

  for (const fallbackOrigin of orderedFallbackOrigins(env, preferredOrigins)) {
    let targetUrl: string;
    try {
      targetUrl = fallbackUrl(record.url, fallbackOrigin);
    } catch (error) {
      failedOrigins.push(`${fallbackOrigin}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (targetUrl === record.url) {
      failedOrigins.push(`${fallbackOrigin}: coincide con la URL original`);
      continue;
    }

    const response = await fetchWithRetry(targetUrl, init, undefined, (candidate) => candidate.status !== 403 && !candidate.ok);
    if (!response.ok) {
      await response.body?.cancel();
      failedOrigins.push(`${fallbackOrigin}: HTTP ${response.status}`);
      console.warn(JSON.stringify({ event: "tienda_inglesa_alias_failed", origin: fallbackOrigin, target_url: targetUrl, status: response.status }));
      continue;
    }

    const html = await response.text();
    if (hasTiendaInglesaProductData(html)) return html;

    failedOrigins.push(`${fallbackOrigin}: respuesta sin datos de producto`);
    console.warn(JSON.stringify({ event: "tienda_inglesa_alias_failed", origin: fallbackOrigin, target_url: targetUrl, status: response.status, reason: "missing_product_data" }));
  }

  throw new ScraperError(`No se pudo leer ningún alias de Tienda Inglesa para ${record.url}: ${failedOrigins.join("; ")}`);
}

async function fetchTiendaInglesaHtml(record: StoreProductRecord, env: Env, preferredOrigins?: string[]): Promise<string> {
  if (preferredOrigins?.length) {
    return fetchFromFallbackOrigins(record, env, preferredOrigins);
  }

  const init = { headers: { "User-Agent": TIENDA_INGLESA_USER_AGENT } };
  const response = await fetchWithRetry(record.url, init, undefined, (candidate) => candidate.status !== 403 && !candidate.ok);
  if (response.ok) {
    const html = await response.text();
    if (hasTiendaInglesaProductData(html)) return html;
    console.warn(JSON.stringify({ event: "tienda_inglesa_primary_failed", source_url: record.url, status: response.status, reason: "missing_product_data" }));
  } else {
    await response.body?.cancel();
    console.warn(JSON.stringify({ event: "tienda_inglesa_primary_failed", source_url: record.url, status: response.status }));
  }

  return fetchFromFallbackOrigins(record, env);
}

export const tiendaInglesaScraper: StoreScraper = {
  slug: "tienda-inglesa",
  async scrape(record: StoreProductRecord, env, context?: StoreScrapeContext): Promise<ScrapeResult> {
    const html = await fetchTiendaInglesaHtml(record, env, context?.tiendaInglesaFallbackOrigins);
    return { price: parseTiendaInglesaHtml(html), source: "html", imageUrl: extractProductImageFromHtml(html, record.url) };
  },
};
