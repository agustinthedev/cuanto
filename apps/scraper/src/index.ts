import { getScraper } from "./stores";
import { fetchWithRetry, sleep } from "./stores/base";
import type { ScrapeContext, ScrapeSummary, StoreProductRecord } from "./types";

const API_TABLES = {
  products: "products",
  storeProducts: "store_products",
  stores: "stores",
  prices: "prices",
} as const;

interface ProductImageRecord {
  id: string;
  image_url: string | null;
  image_source_store_product_id: string | null;
  image_updated_at: string | null;
}

const IMAGE_STORE_PRIORITY: Record<string, number> = {
  disco: 10,
  "tienda-inglesa": 20,
  "ta-ta": 30,
  "el-dorado": 40,
  "red-express": 50,
};

const TIENDA_INGLESA_REQUEST_DELAY_MS = 500;

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

async function loadActiveStoreProducts(env: Env, productId?: string): Promise<StoreProductRecord[]> {
  const productFilter = productId ? `&product_id=eq.${encodeURIComponent(productId)}` : "";
  const [storesResponse, productsResponse] = await Promise.all([
    fetchWithRetry(apiUrl(env, API_TABLES.stores, "select=id,slug"), { headers: apiHeaders(env) }),
    fetchWithRetry(apiUrl(env, API_TABLES.storeProducts, `select=id,product_id,store_id,location_id,url,external_name,image_url&active=eq.true${productFilter}`), { headers: apiHeaders(env) }),
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

async function loadProductImages(env: Env, productId?: string): Promise<Map<string, ProductImageRecord>> {
  const productFilter = productId ? `&id=eq.${encodeURIComponent(productId)}` : "";
  const response = await fetchWithRetry(apiUrl(env, API_TABLES.products, `select=id,image_url,image_source_store_product_id,image_updated_at${productFilter}`), { headers: apiHeaders(env) });
  if (!response.ok) throw new Error(`No se pudieron cargar las imágenes de productos: HTTP ${response.status}`);
  const products = await response.json() as ProductImageRecord[];
  return new Map(products.map((product) => [product.id, product]));
}

async function savePrice(env: Env, record: StoreProductRecord, price: number, date: string) {
  const response = await fetchWithRetry(apiUrl(env, API_TABLES.prices, "on_conflict=store_product_id,date"), {
    method: "POST",
    headers: apiHeaders(env, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({ store_product_id: record.id, price, date, scraped_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`No se pudo guardar el precio: HTTP ${response.status} ${await response.text()}`);
}

async function saveStoreProductImage(env: Env, record: StoreProductRecord, imageUrl: string, fetchedAt: string) {
  const response = await fetchWithRetry(apiUrl(env, API_TABLES.storeProducts, `id=eq.${encodeURIComponent(record.id)}`), {
    method: "PATCH",
    headers: apiHeaders(env, "return=minimal"),
    body: JSON.stringify({ image_url: imageUrl, image_fetched_at: fetchedAt }),
  });
  if (!response.ok) throw new Error(`No se pudo guardar la imagen de la publicación: HTTP ${response.status} ${await response.text()}`);
}

async function promoteProductImage(
  env: Env,
  record: StoreProductRecord,
  imageUrl: string,
  fetchedAt: string,
  productImages: Map<string, ProductImageRecord>,
) {
  const current = productImages.get(record.product_id);
  if (!current || current.image_url) return;

  const response = await fetchWithRetry(apiUrl(env, API_TABLES.products, `id=eq.${encodeURIComponent(record.product_id)}&image_url=is.null`), {
    method: "PATCH",
    headers: apiHeaders(env, "return=minimal"),
    body: JSON.stringify({
      image_url: imageUrl,
      image_source_store_product_id: record.id,
      image_updated_at: fetchedAt,
    }),
  });
  if (!response.ok) throw new Error(`No se pudo actualizar la imagen del producto: HTTP ${response.status} ${await response.text()}`);
  productImages.set(record.product_id, {
    ...current,
    image_url: imageUrl,
    image_source_store_product_id: record.id,
    image_updated_at: fetchedAt,
  });
}

function imagePriority(storeSlug: string): number {
  return IMAGE_STORE_PRIORITY[storeSlug] ?? 100;
}

function uruguayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export interface ScrapeOptions {
  productId?: string;
}

export async function runScrape(env: Env, now = new Date(), options: ScrapeOptions = {}): Promise<ScrapeSummary> {
  const [records, productImages] = await Promise.all([loadActiveStoreProducts(env, options.productId), loadProductImages(env, options.productId)]);
  records.sort((left, right) => imagePriority(left.store_slug) - imagePriority(right.store_slug));
  const date = uruguayDate(now);
  const summary: ScrapeSummary = { attempted: records.length, saved: 0, failed: 0 };
  const context: ScrapeContext = {};
  let previousStoreSlug: string | undefined;

  for (const record of records) {
    if (record.store_slug === "tienda-inglesa" && previousStoreSlug === record.store_slug) {
      console.log(JSON.stringify({ event: "store_request_delay", store: record.store_slug, delay_ms: TIENDA_INGLESA_REQUEST_DELAY_MS }));
      await sleep(TIENDA_INGLESA_REQUEST_DELAY_MS);
    }

    try {
      const scraper = getScraper(record.store_slug);
      if (!scraper) throw new Error(`No hay adapter para ${record.store_slug}`);
      const result = await scraper.scrape(record, env, context);
      if (!Number.isFinite(result.price) || result.price <= 0) throw new Error("El adapter devolvió un precio inválido");
      await savePrice(env, record, result.price, date);
      summary.saved += 1;
      if (result.imageUrl) {
        const imageFetchedAt = new Date().toISOString();
        try {
          await saveStoreProductImage(env, record, result.imageUrl, imageFetchedAt);
          await promoteProductImage(env, record, result.imageUrl, imageFetchedAt, productImages);
          console.log(JSON.stringify({ event: "product_image_saved", store: record.store_slug, store_product_id: record.id, product_id: record.product_id, image_url: result.imageUrl }));
        } catch (error) {
          console.error(JSON.stringify({ event: "product_image_failed", store: record.store_slug, store_product_id: record.id, product_id: record.product_id, reason: error instanceof Error ? error.message : String(error) }));
        }
      }
      console.log(JSON.stringify({ event: "price_saved", store: record.store_slug, store_product_id: record.id, date, price: result.price }));
    } catch (error) {
      summary.failed += 1;
      console.error(JSON.stringify({ event: "scrape_failed", store: record.store_slug, store_product_id: record.id, url: record.url, timestamp: new Date().toISOString(), reason: error instanceof Error ? error.message : String(error) }));
    } finally {
      previousStoreSlug = record.store_slug;
    }
  }
  return summary;
}

const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function configuredOrigins(env: Env): string[] {
  return (env.CORS_ORIGIN ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
}

function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get("Origin");
  return !origin || configuredOrigins(env).includes(origin);
}

function responseHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ "Content-Type": "application/json", Vary: "Origin" });
  const origin = request.headers.get("Origin");
  if (origin && configuredOrigins(env).includes(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function jsonResponse(request: Request, env: Env, body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = responseHeaders(request, env);
  Object.entries(extraHeaders ?? {}).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(body), { status, headers });
}

async function isAdminRequest(request: Request, env: Env): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return false;

  const userResponse = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: authorization,
    },
  });
  if (!userResponse.ok) return false;

  const user = await userResponse.json() as { id?: unknown };
  if (typeof user.id !== "string" || !PRODUCT_ID_PATTERN.test(user.id)) return false;

  const adminResponse = await fetch(apiUrl(env, "admin_users", `select=user_id&user_id=eq.${encodeURIComponent(user.id)}`), { headers: apiHeaders(env) });
  if (!adminResponse.ok) throw new Error(`No se pudo verificar el administrador: HTTP ${adminResponse.status}`);
  const admins = await adminResponse.json() as Array<{ user_id?: string }>;
  return admins.some((admin) => admin.user_id === user.id);
}

async function handleProductScrape(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!isAllowedOrigin(request, env)) return jsonResponse(request, env, { error: "Origin not allowed" }, 403);

  let admin = false;
  try {
    admin = await isAdminRequest(request, env);
  } catch (error) {
    console.error(JSON.stringify({ event: "scrape_authorization_failed", reason: error instanceof Error ? error.message : String(error) }));
    return jsonResponse(request, env, { error: "Unable to verify administrator access" }, 502);
  }
  if (!admin) return jsonResponse(request, env, { error: "Admin access required" }, 401, { "WWW-Authenticate": "Bearer" });

  let payload: { product_id?: unknown };
  try {
    payload = await request.json() as { product_id?: unknown };
  } catch {
    return jsonResponse(request, env, { error: "A JSON body is required" }, 400);
  }
  const productId = typeof payload.product_id === "string" ? payload.product_id.trim() : "";
  if (!PRODUCT_ID_PATTERN.test(productId)) return jsonResponse(request, env, { error: "A valid product_id is required" }, 400);

  const scrapePromise = runScrape(env, new Date(), { productId })
    .then((summary) => console.log(JSON.stringify({ event: "product_scrape_finished", product_id: productId, ...summary })))
    .catch((error) => console.error(JSON.stringify({ event: "product_scrape_failed", product_id: productId, reason: error instanceof Error ? error.message : String(error) })));
  ctx.waitUntil(scrapePromise);
  console.log(JSON.stringify({ event: "product_scrape_requested", product_id: productId }));
  return jsonResponse(request, env, { accepted: true, product_id: productId }, 202);
}

export default {
  async scheduled(_controller: ScheduledController, env: Env) {
    const summary = await runScrape(env);
    console.log(JSON.stringify({ event: "scrape_finished", ...summary }));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return jsonResponse(request, env, { ok: true, service: "cuanto-scraper" });
    if (url.pathname === "/scrape/product") {
      if (request.method === "OPTIONS") {
        if (!isAllowedOrigin(request, env)) return new Response(null, { status: 403 });
        const headers = responseHeaders(request, env);
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        headers.set("Access-Control-Max-Age", "86400");
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== "POST") return jsonResponse(request, env, { error: "Method not allowed" }, 405, { Allow: "POST, OPTIONS" });
      return handleProductScrape(request, env, ctx);
    }
    return jsonResponse(request, env, { error: "Not found" }, 404);
  },
};
