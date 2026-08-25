import { getScraper } from "./stores";
import type { ScrapeSummary, StoreProductRecord } from "./types";

const API_TABLES = {
  storeProducts: "store_products",
  stores: "stores",
  prices: "prices",
} as const;

function apiUrl(env: Env, table: string, query = "") {
  return `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

function apiHeaders(env: Env, prefer?: string): Headers {
  const headers = new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  });
  if (prefer) headers.set("Prefer", prefer);
  return headers;
}

async function loadActiveStoreProducts(env: Env): Promise<StoreProductRecord[]> {
  const [storesResponse, productsResponse] = await Promise.all([
    fetch(apiUrl(env, API_TABLES.stores, "select=id,slug"), { headers: apiHeaders(env) }),
    fetch(apiUrl(env, API_TABLES.storeProducts, "select=id,product_id,store_id,location_id,url,external_name&active=eq.true"), { headers: apiHeaders(env) }),
  ]);
  if (!storesResponse.ok) throw new Error(`No se pudieron cargar las cadenas: HTTP ${storesResponse.status}`);
  if (!productsResponse.ok) throw new Error(`No se pudieron cargar los productos: HTTP ${productsResponse.status}`);
  const stores = await storesResponse.json() as Array<{ id: string; slug: string }>;
  const products = await productsResponse.json() as Omit<StoreProductRecord, "store_slug">[];
  const storeSlugs = new Map(stores.map((store) => [store.id, store.slug]));
  return products.flatMap((product) => {
    const storeSlug = storeSlugs.get(product.store_id);
    return storeSlug ? [{ ...product, store_slug: storeSlug }] : [];
  });
}

async function savePrice(env: Env, record: StoreProductRecord, price: number, date: string) {
  const response = await fetch(apiUrl(env, API_TABLES.prices, "on_conflict=store_product_id,date"), {
    method: "POST",
    headers: apiHeaders(env, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({ store_product_id: record.id, price, date, scraped_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`No se pudo guardar el precio: HTTP ${response.status} ${await response.text()}`);
}

function uruguayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function runScrape(env: Env, now = new Date()): Promise<ScrapeSummary> {
  const records = await loadActiveStoreProducts(env);
  const date = uruguayDate(now);
  const summary: ScrapeSummary = { attempted: records.length, saved: 0, failed: 0 };

  for (const record of records) {
    try {
      const scraper = getScraper(record.store_slug);
      if (!scraper) throw new Error(`No hay adapter para ${record.store_slug}`);
      const result = await scraper.scrape(record, env);
      if (!Number.isFinite(result.price) || result.price <= 0) throw new Error("El adapter devolvió un precio inválido");
      await savePrice(env, record, result.price, date);
      summary.saved += 1;
      console.log(JSON.stringify({ event: "price_saved", store: record.store_slug, store_product_id: record.id, date, price: result.price }));
    } catch (error) {
      summary.failed += 1;
      console.error(JSON.stringify({ event: "scrape_failed", store: record.store_slug, store_product_id: record.id, url: record.url, timestamp: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) }));
    }
  }
  return summary;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env) {
    const summary = await runScrape(env);
    console.log(JSON.stringify({ event: "scrape_finished", ...summary }));
  },
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response(JSON.stringify({ ok: true, service: "cuanto-scraper" }), { headers: { "Content-Type": "application/json" } });
    return new Response("Not found", { status: 404 });
  },
};
