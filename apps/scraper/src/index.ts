import { getScraper } from "./stores";
import { fetchWithRetry, sleep } from "./stores/base";
import { probeTiendaInglesaFallbackOrigin, tiendaInglesaFallbackOrigins } from "./stores/tienda-inglesa";
import type { ScrapeQueueMessage, ScrapeSummary, ScrapeResult, StoreProductRecord, StoreScrapeContext } from "./types";

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
const QUEUE_SEND_BATCH_SIZE = 100;

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

interface PriceUpsert {
  store_product_id: string;
  price: number;
  date: string;
  scraped_at: string;
}

async function savePrices(env: Env, rows: PriceUpsert[]) {
  if (rows.length === 0) return;

  const response = await fetchWithRetry(apiUrl(env, API_TABLES.prices, "on_conflict=store_product_id,date"), {
    method: "POST",
    headers: apiHeaders(env, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`No se pudieron guardar los precios: HTTP ${response.status} ${await response.text()}`);
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

function scrapeQueue(env: Env): Queue<ScrapeQueueMessage> {
  const queue = env.SCRAPE_QUEUE;
  if (!queue) throw new Error("La Queue de scraping no está configurada");
  return queue;
}

export function buildScrapeQueueMessages(
  records: StoreProductRecord[],
  productImages: Map<string, ProductImageRecord>,
  runId: string,
  date: string,
  tiendaInglesaOrigins?: string[],
  tiendaInglesaPreviouslyFailedOrigins?: string[],
): ScrapeQueueMessage[] {
  const recordsByProduct = new Map<string, StoreProductRecord[]>();
  for (const record of records) {
    const current = recordsByProduct.get(record.product_id) ?? [];
    current.push(record);
    recordsByProduct.set(record.product_id, current);
  }

  return [...recordsByProduct.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([productId, storeProducts]) => ({
      run_id: runId,
      date,
      product_id: productId,
      product_image_url: productImages.get(productId)?.image_url ?? null,
      store_products: [...storeProducts].sort((left, right) => imagePriority(left.store_slug) - imagePriority(right.store_slug)),
      ...(storeProducts.some((record) => record.store_slug === "tienda-inglesa") && tiendaInglesaOrigins?.length
        ? { tienda_inglesa_fallback_origins: tiendaInglesaOrigins }
        : {}),
      ...(storeProducts.some((record) => record.store_slug === "tienda-inglesa") && tiendaInglesaPreviouslyFailedOrigins?.length
        ? { tienda_inglesa_previously_failed_origins: tiendaInglesaPreviouslyFailedOrigins }
        : {}),
    }));
}

export interface DispatchSummary {
  run_id: string;
  date: string;
  products: number;
  store_products: number;
  messages: number;
}

interface TiendaInglesaFallbackSelection {
  origins: string[];
  previouslyFailedOrigins: string[];
}

export async function selectTiendaInglesaFallbackOrigins(records: StoreProductRecord[], env: Env): Promise<TiendaInglesaFallbackSelection> {
  const origins = tiendaInglesaFallbackOrigins(env);
  const canary = records.find((record) => record.store_slug === "tienda-inglesa");
  if (!canary || origins.length < 2) return { origins, previouslyFailedOrigins: [] };
  const previouslyFailedOrigins: string[] = [];

  for (const origin of origins) {
    if (await probeTiendaInglesaFallbackOrigin(canary, origin)) {
      const selectedOrigins = [origin, ...origins.filter((candidate) => candidate !== origin)];
      console.log(JSON.stringify({ event: "tienda_inglesa_alias_selected", origin, canary_store_product_id: canary.id, previously_failed_origins: previouslyFailedOrigins }));
      return { origins: selectedOrigins, previouslyFailedOrigins };
    }
    previouslyFailedOrigins.push(origin);
  }

  console.warn(JSON.stringify({ event: "tienda_inglesa_alias_probe_exhausted", canary_store_product_id: canary.id, origins }));
  return { origins, previouslyFailedOrigins };
}

export async function dispatchDailyRun(env: Env, scheduledTime = new Date()): Promise<DispatchSummary> {
  const [records, productImages] = await Promise.all([loadActiveStoreProducts(env), loadProductImages(env)]);
  const date = uruguayDate(scheduledTime);
  const tiendaInglesaSelection = await selectTiendaInglesaFallbackOrigins(records, env);
  const messages = buildScrapeQueueMessages(
    records,
    productImages,
    scheduledTime.toISOString(),
    date,
    tiendaInglesaSelection.origins,
    tiendaInglesaSelection.previouslyFailedOrigins,
  );
  const queue = scrapeQueue(env);

  for (let index = 0; index < messages.length; index += QUEUE_SEND_BATCH_SIZE) {
    const chunk = messages.slice(index, index + QUEUE_SEND_BATCH_SIZE);
    await queue.sendBatch(chunk.map((body) => ({ body })));
  }

  return { run_id: scheduledTime.toISOString(), date, products: messages.length, store_products: records.length, messages: messages.length };
}

async function scrapeStoreProduct(env: Env, record: StoreProductRecord, context?: StoreScrapeContext): Promise<ScrapeResult> {
  const scraper = getScraper(record.store_slug);
  if (!scraper) throw new Error(`No hay adapter para ${record.store_slug}`);

  const result = await scraper.scrape(record, env, context);
  if (!Number.isFinite(result.price) || result.price <= 0) throw new Error("El adapter devolvió un precio inválido");
  return result;
}

function isScrapeQueueMessage(value: unknown): value is ScrapeQueueMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ScrapeQueueMessage>;
  const storeProducts = message.store_products;
  return typeof message.run_id === "string"
    && typeof message.date === "string"
    && typeof message.product_id === "string"
    && (message.product_image_url === null || typeof message.product_image_url === "string")
    && (message.tienda_inglesa_fallback_origins === undefined
      || (Array.isArray(message.tienda_inglesa_fallback_origins) && message.tienda_inglesa_fallback_origins.every((origin) => typeof origin === "string")))
    && (message.tienda_inglesa_previously_failed_origins === undefined
      || (Array.isArray(message.tienda_inglesa_previously_failed_origins) && message.tienda_inglesa_previously_failed_origins.every((origin) => typeof origin === "string")))
    && Array.isArray(storeProducts)
    && storeProducts.length > 0
    && storeProducts.every((record) => (
      !!record
      && typeof record === "object"
      && typeof record.id === "string"
      && typeof record.product_id === "string"
      && record.product_id === message.product_id
      && typeof record.store_id === "string"
      && (record.location_id === null || typeof record.location_id === "string")
      && typeof record.url === "string"
      && (record.external_name === null || typeof record.external_name === "string")
      && (record.image_url === null || typeof record.image_url === "string")
      && typeof record.store_slug === "string"
    ));
}

interface FailedStoreProduct {
  record: StoreProductRecord;
  error: unknown;
}

export async function performScrapeMessage(env: Env, message: ScrapeQueueMessage): Promise<ScrapeSummary> {
  const records = [...message.store_products].sort((left, right) => imagePriority(left.store_slug) - imagePriority(right.store_slug));
  const productImages = new Map<string, ProductImageRecord>([[message.product_id, {
    id: message.product_id,
    image_url: message.product_image_url,
    image_source_store_product_id: null,
    image_updated_at: null,
  }]]);
  const successful: Array<{ record: StoreProductRecord; result: ScrapeResult }> = [];
  const failed: FailedStoreProduct[] = [];
  const context: StoreScrapeContext = {
    tiendaInglesaFallbackOrigins: message.tienda_inglesa_fallback_origins,
    tiendaInglesaPreviouslyFailedOrigins: message.tienda_inglesa_previously_failed_origins,
  };

  for (const record of records) {
    if (record.store_slug === "tienda-inglesa") {
      console.log(JSON.stringify({ event: "store_request_delay", store: record.store_slug, delay_ms: TIENDA_INGLESA_REQUEST_DELAY_MS }));
      await sleep(TIENDA_INGLESA_REQUEST_DELAY_MS);
    }

    try {
      const result = await scrapeStoreProduct(env, record, context);
      successful.push({ record, result });
    } catch (error) {
      failed.push({ record, error });
      console.error(JSON.stringify({
        event: "scrape_failed",
        run_id: message.run_id,
        store: record.store_slug,
        store_product_id: record.id,
        url: record.url,
        timestamp: new Date().toISOString(),
        reason: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  await savePrices(env, successful.map(({ record, result }) => ({
    store_product_id: record.id,
    price: result.price,
    date: message.date,
    scraped_at: new Date().toISOString(),
  })));

  for (const { record, result } of successful) {
    if (!result.imageUrl) continue;

    const imageFetchedAt = new Date().toISOString();
    try {
      if (record.image_url !== result.imageUrl) {
        await saveStoreProductImage(env, record, result.imageUrl, imageFetchedAt);
      }
      await promoteProductImage(env, record, result.imageUrl, imageFetchedAt, productImages);
      console.log(JSON.stringify({ event: "product_image_saved", run_id: message.run_id, store: record.store_slug, store_product_id: record.id, product_id: record.product_id, image_url: result.imageUrl }));
    } catch (error) {
      console.error(JSON.stringify({ event: "product_image_failed", run_id: message.run_id, store: record.store_slug, store_product_id: record.id, product_id: record.product_id, reason: error instanceof Error ? error.message : String(error) }));
    }
  }

  if (failed.length > 0) {
    if (records.length === 1) {
      throw failed[0].error instanceof Error ? failed[0].error : new Error(String(failed[0].error));
    }

    const queue = scrapeQueue(env);
    const retryMessages = failed.map(({ record }) => ({
      run_id: message.run_id,
      date: message.date,
      product_id: message.product_id,
      product_image_url: message.product_image_url,
      store_products: [record],
      ...(message.tienda_inglesa_fallback_origins ? { tienda_inglesa_fallback_origins: message.tienda_inglesa_fallback_origins } : {}),
      ...(message.tienda_inglesa_previously_failed_origins ? { tienda_inglesa_previously_failed_origins: message.tienda_inglesa_previously_failed_origins } : {}),
    } satisfies ScrapeQueueMessage));
    await queue.sendBatch(retryMessages.map((body) => ({ body })));
  }

  return { attempted: records.length, saved: successful.length, failed: failed.length };
}

export interface ScrapeOptions {
  productId?: string;
}

export async function runScrape(env: Env, now = new Date(), options: ScrapeOptions = {}): Promise<ScrapeSummary> {
  const [records, productImages] = await Promise.all([loadActiveStoreProducts(env, options.productId), loadProductImages(env, options.productId)]);
  records.sort((left, right) => imagePriority(left.store_slug) - imagePriority(right.store_slug));
  const date = uruguayDate(now);
  const summary: ScrapeSummary = { attempted: records.length, saved: 0, failed: 0 };
  const context: StoreScrapeContext = {};
  let previousStoreSlug: string | undefined;

  for (const record of records) {
    if (record.store_slug === "tienda-inglesa" && previousStoreSlug === record.store_slug) {
      console.log(JSON.stringify({ event: "store_request_delay", store: record.store_slug, delay_ms: TIENDA_INGLESA_REQUEST_DELAY_MS }));
      await sleep(TIENDA_INGLESA_REQUEST_DELAY_MS);
    }

    try {
      const result = await scrapeStoreProduct(env, record, context);
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
  async scheduled(controller: ScheduledController, env: Env) {
    const summary = await dispatchDailyRun(env, new Date(controller.scheduledTime));
    console.log(JSON.stringify({ event: "scrape_dispatch_finished", ...summary }));
  },
  async queue(batch: MessageBatch<unknown>, env: Env) {
    for (const message of batch.messages) {
      if (!isScrapeQueueMessage(message.body)) throw new Error("El mensaje de scraping tiene un formato inválido");
      const summary = await performScrapeMessage(env, message.body);
      console.log(JSON.stringify({ event: "scrape_product_finished", ...summary, product_id: message.body.product_id, run_id: message.body.run_id }));
    }
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
