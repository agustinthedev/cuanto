import { afterEach, describe, expect, it, vi } from "vitest";
import productPayload from "./fixtures/eldorado-product.json";
import worker, { buildScrapeQueueMessages, dispatchDailyRun, performScrapeMessage, runScrape } from "./index";
import { EL_DORADO_ORIGIN, EL_DORADO_REGION_ID } from "./stores/el-dorado";
import type { ScrapeQueueMessage } from "./types";

const elDoradoRegionIdEncoded = btoa(EL_DORADO_REGION_ID);

describe("ejecución diaria", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("guarda el precio y dona la imagen de la publicación al producto", async () => {
    const savedPriceBodies: unknown[] = [];
    const savedStoreImageBodies: unknown[] = [];
    const savedProductImageBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "disco" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products") && init?.method === "PATCH") {
        savedStoreImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: "https://example.test/product",
        external_name: null,
        image_url: null,
      }]), { status: 200 });
      if (url.includes("/rest/v1/products") && init?.method === "PATCH") {
        savedProductImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([{
        id: "product-1",
        image_url: null,
        image_source_store_product_id: null,
        image_updated_at: null,
      }]), { status: 200 });
      if (url === "https://example.test/product") return new Response('<meta property="og:image" content="/images/product.jpg"><meta property="product:price:amount" content="1299.00"><main><h1>Producto</h1><strong>$ 1.299</strong></main>', { status: 200 });
      if (url.includes("/rest/v1/prices")) {
        savedPriceBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 201 });
      }
      return new Response("Not found", { status: 404 });
    }));

    const result = await runScrape({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" }, new Date("2026-08-25T12:00:00Z"));
    expect(result).toEqual({ attempted: 1, saved: 1, failed: 0 });
    expect(savedPriceBodies).toEqual([{ store_product_id: "store-product-1", price: 1299, date: "2026-08-25", scraped_at: expect.any(String) }]);
    expect(savedStoreImageBodies).toEqual([{ image_url: "https://example.test/images/product.jpg", image_fetched_at: expect.any(String) }]);
    expect(savedProductImageBodies).toEqual([{
      image_url: "https://example.test/images/product.jpg",
      image_source_store_product_id: "store-product-1",
      image_updated_at: expect.any(String),
    }]);
    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes("on_conflict=store_product_id,date"))).toBe(true);
  });

  it("espera entre productos consecutivos de Tienda Inglesa", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "tienda-inglesa" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([
        { id: "store-product-1", product_id: "product-1", store_id: "store-1", location_id: null, url: "https://example.test/product-1", external_name: null, image_url: null },
        { id: "store-product-2", product_id: "product-2", store_id: "store-1", location_id: null, url: "https://example.test/product-2", external_name: null, image_url: null },
      ]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([
        { id: "product-1", image_url: null, image_source_store_product_id: null, image_updated_at: null },
        { id: "product-2", image_url: null, image_source_store_product_id: null, image_updated_at: null },
      ]), { status: 200 });
      if (url.includes("/rest/v1/prices")) return new Response(null, { status: 201 });
      if (url.startsWith("https://example.test/")) return new Response('{"WProductUI_PARM":{"Prices":[{"Label":"Precio","Price":10}]}}', { status: 200 });
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const scrape = runScrape({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" }, new Date("2026-08-25T12:00:00Z"));
    await vi.runAllTimersAsync();
    await expect(scrape).resolves.toEqual({ attempted: 2, saved: 2, failed: 0 });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
  });

  it("usa el alias de Tienda Inglesa inmediatamente ante un 403 y conserva la URL original", async () => {
    vi.useFakeTimers();
    const canonicalUrl = "https://www.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const fallbackUrl = "https://prod-web-blue.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const savedPriceBodies: unknown[] = [];
    const scraperUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "tienda-inglesa" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: canonicalUrl,
        external_name: "Café",
        image_url: null,
      }]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([{
        id: "product-1",
        image_url: null,
        image_source_store_product_id: null,
        image_updated_at: null,
      }]), { status: 200 });
      if (url.includes("/rest/v1/prices")) {
        savedPriceBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 201 });
      }
      if (url === canonicalUrl) {
        scraperUrls.push(url);
        return new Response("Just a moment...", { status: 403 });
      }
      if (url === fallbackUrl) {
        scraperUrls.push(url);
        return new Response('{"W0032AV27ProductUI_PARM":{"Prices":[{"Label":"Precio","Price":123.45}]}}', { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const scrape = runScrape(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        TIENDA_INGLESA_FALLBACK_ORIGIN: "https://prod-web-blue.tiendainglesa.com.uy",
      },
      new Date("2026-08-25T12:00:00Z"),
    );
    await vi.runAllTimersAsync();

    await expect(scrape).resolves.toEqual({ attempted: 1, saved: 1, failed: 0 });
    expect(scraperUrls).toEqual([canonicalUrl, fallbackUrl]);
    expect(savedPriceBodies).toEqual([{ store_product_id: "store-product-1", price: 123.45, date: "2026-08-25", scraped_at: expect.any(String) }]);
  });

  it("puede limitarse a las publicaciones activas de un producto", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "disco" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response("Not found", { status: 404 });
    }));

    await runScrape(
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" },
      new Date("2026-08-25T12:00:00Z"),
      { productId: "product-1" },
    );

    const storeProductsUrl = vi.mocked(fetch).mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/rest/v1/store_products"));
    const productsUrl = vi.mocked(fetch).mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/rest/v1/products"));
    expect(storeProductsUrl).toContain("active=eq.true&product_id=eq.product-1");
    expect(productsUrl).toContain("id=eq.product-1");
    vi.unstubAllGlobals();
  });

  it("acepta un scrape puntual para un administrador autenticado", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const productId = "22222222-2222-4222-8222-222222222222";
    const pendingTasks: Promise<unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return new Response(JSON.stringify({ id: userId }), { status: 200 });
      if (url.includes("/rest/v1/admin_users")) return new Response(JSON.stringify([{ user_id: userId }]), { status: 200 });
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response("Not found", { status: 404 });
    }));

    const response = await worker.fetch(
      new Request("https://scraper.test/scrape/product", {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          Authorization: "Bearer user-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: productId }),
      }),
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        CORS_ORIGIN: "http://localhost:5173",
      },
      { waitUntil: (task: Promise<unknown>) => { pendingTasks.push(task); } } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true, product_id: productId });
    expect(pendingTasks).toHaveLength(1);
    await Promise.all(pendingTasks);
    const storeProductsUrl = vi.mocked(fetch).mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/rest/v1/store_products"));
    expect(storeProductsUrl).toContain(`active=eq.true&product_id=eq.${productId}`);
    vi.unstubAllGlobals();
  });

  it("rechaza el scrape puntual sin autenticación de administrador", async () => {
    const response = await worker.fetch(
      new Request("https://scraper.test/scrape/product", {
        method: "POST",
        headers: {
          Origin: "http://localhost:5173",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: "22222222-2222-4222-8222-222222222222" }),
      }),
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        CORS_ORIGIN: "http://localhost:5173",
      },
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );

    expect(response.status).toBe(401);
  });
});

describe("flujo con Queue", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("agrupa las publicaciones por producto y conserva las imágenes actuales", () => {
    const records = [
      {
        id: "store-product-disco",
        product_id: "product-1",
        store_id: "store-disco",
        location_id: null,
        url: "https://example.test/disco",
        external_name: null,
        image_url: "https://images.test/disco.jpg",
        store_slug: "disco",
      },
      {
        id: "store-product-tata",
        product_id: "product-1",
        store_id: "store-tata",
        location_id: null,
        url: "https://example.test/tata",
        external_name: null,
        image_url: null,
        store_slug: "ta-ta",
      },
    ];

    const messages = buildScrapeQueueMessages(
      records,
      new Map([["product-1", {
        id: "product-1",
        image_url: "https://images.test/product.jpg",
        image_source_store_product_id: "store-product-disco",
        image_updated_at: "2026-08-25T12:00:00.000Z",
      }]]),
      "run-1",
      "2026-09-02",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ run_id: "run-1", date: "2026-09-02", product_id: "product-1", product_image_url: "https://images.test/product.jpg" });
    expect(messages[0].store_products.map((record) => record.store_slug)).toEqual(["disco", "ta-ta"]);
  });

  it("despacha un mensaje por producto y el performer hace un bulk upsert de precios", async () => {
    const sentBatches: unknown[] = [];
    const queue = { sendBatch: vi.fn(async (messages: unknown[]) => { sentBatches.push(messages); }) };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "disco" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: "https://example.test/disco",
        external_name: null,
        image_url: null,
      }]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([{
        id: "product-1",
        image_url: null,
        image_source_store_product_id: null,
        image_updated_at: null,
      }]), { status: 200 });
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dispatched = await dispatchDailyRun(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: queue,
      } as unknown as Env,
      new Date("2026-09-02T07:00:00Z"),
    );

    expect(dispatched).toMatchObject({ date: "2026-09-02", products: 1, messages: 1 });
    expect(sentBatches).toHaveLength(1);
    expect((sentBatches[0] as Array<{ body: { product_id: string } }>)[0].body.product_id).toBe("product-1");

    const savedPriceBodies: unknown[] = [];
    const savedStoreImageBodies: unknown[] = [];
    const savedProductImageBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/prices")) {
        savedPriceBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 201 });
      }
      if (url.includes("/rest/v1/store_products") && init?.method === "PATCH") {
        savedStoreImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("/rest/v1/products") && init?.method === "PATCH") {
        savedProductImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url === "https://example.test/disco") return new Response('<meta property="og:image" content="/images/product.jpg"><meta property="product:price:amount" content="1299.00">', { status: 200 });
      if (url.includes("operationName=ValidateSession")) return new Response(JSON.stringify({
        data: { validateSession: {
          country: "URY",
          postalCode: "11800",
          channel: '{"salesChannel":"4","regionId":"U1cjdGF0YXRhdW1vbnRldmlkZW8="}',
          locale: "es-uy",
        } },
      }), { status: 200 });
      if (url.startsWith("https://example.test/tata/producto-p?")) return new Response(`
        <span data-testid="list-price" data-value="1400">$ 1.400,00</span>
        <span data-testid="price" data-value="1190">$ 1.190,00</span>
      `, { status: 200 });
      return new Response("Not found", { status: 404 });
    }));

    const result = await performScrapeMessage(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: queue,
      } as unknown as Env,
      {
        run_id: "run-1",
        date: "2026-09-02",
        product_id: "product-1",
        product_image_url: null,
        store_products: [
          {
            id: "store-product-1",
            product_id: "product-1",
            store_id: "store-1",
            location_id: null,
            url: "https://example.test/disco",
            external_name: null,
            image_url: null,
            store_slug: "disco",
          },
          {
            id: "store-product-2",
            product_id: "product-1",
            store_id: "store-2",
            location_id: null,
            url: "https://example.test/tata/producto-p",
            external_name: null,
            image_url: null,
            store_slug: "ta-ta",
          },
        ],
      },
    );

    expect(result).toEqual({ attempted: 2, saved: 2, failed: 0 });
    expect(savedPriceBodies).toHaveLength(1);
    expect(savedPriceBodies[0]).toEqual([
      { store_product_id: "store-product-1", price: 1299, date: "2026-09-02", scraped_at: expect.any(String) },
      { store_product_id: "store-product-2", price: 1400, date: "2026-09-02", scraped_at: expect.any(String) },
    ]);
    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    const tataUrl = calledUrls.find((url) => url.startsWith("https://example.test/tata/producto-p?"));
    expect(tataUrl).toBeDefined();
    expect(new URL(tataUrl!).searchParams.get("country")).toBe("URY");
    expect(new URL(tataUrl!).searchParams.get("postalCode")).toBe("11800");
    expect(calledUrls.some((url) => url.includes("operationName=BrowserProductQuery"))).toBe(false);
    expect(savedStoreImageBodies).toHaveLength(1);
    expect(savedProductImageBodies).toHaveLength(1);
  });

  it("procesa El Dorado dentro del performer y reutiliza la sesión regional del mensaje", async () => {
    const savedPriceBodies: unknown[] = [];
    const savedStoreImageBodies: unknown[] = [];
    const savedProductImageBodies: unknown[] = [];
    const queue = { sendBatch: vi.fn(async () => undefined) };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/prices")) {
        savedPriceBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 201 });
      }
      if (url.includes("/rest/v1/store_products") && init?.method === "PATCH") {
        savedStoreImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("/rest/v1/products") && init?.method === "PATCH") {
        savedProductImageBodies.push(JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
      if (url === `${EL_DORADO_ORIGIN}/`) {
        return new Response("", { status: 200, headers: { "Set-Cookie": "vtex_session=session; Path=/" } });
      }
      if (url === `${EL_DORADO_ORIGIN}/api/sessions` && init?.method === "PATCH") {
        return new Response("", { status: 201, headers: { "Set-Cookie": "vtex_segment=segment; Path=/" } });
      }
      if (url === `${EL_DORADO_ORIGIN}/api/sessions?items=*`) {
        return new Response(JSON.stringify({ namespaces: { checkout: { regionId: { value: elDoradoRegionIdEncoded } } } }), { status: 200 });
      }
      if (url.includes("/api/catalog_system/pub/products/search/")) {
        return new Response(JSON.stringify(productPayload), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await performScrapeMessage(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: queue,
      } as unknown as Env,
      {
        run_id: "run-1",
        date: "2026-09-02",
        product_id: "product-1",
        product_image_url: null,
        store_products: [
          {
            id: "store-product-1",
            product_id: "product-1",
            store_id: "store-el-dorado",
            location_id: "location-centro",
            url: "https://www.eldorado.com.uy/queso-el-dorado-muzzarella-kg/p",
            external_name: null,
            image_url: null,
            store_slug: "el-dorado",
          },
          {
            id: "store-product-2",
            product_id: "product-1",
            store_id: "store-el-dorado",
            location_id: "location-barrio-sur",
            url: "https://www.eldorado.com.uy/papa-rosada-kg/p",
            external_name: null,
            image_url: null,
            store_slug: "el-dorado",
          },
        ],
      },
    );

    expect(result).toEqual({ attempted: 2, saved: 2, failed: 0 });
    expect(savedPriceBodies).toEqual([[
      { store_product_id: "store-product-1", price: 499, date: "2026-09-02", scraped_at: expect.any(String) },
      { store_product_id: "store-product-2", price: 499, date: "2026-09-02", scraped_at: expect.any(String) },
    ]]);
    expect(savedStoreImageBodies).toHaveLength(2);
    expect(savedProductImageBodies).toHaveLength(1);

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.filter(([input]) => String(input) === `${EL_DORADO_ORIGIN}/`)).toHaveLength(1);
    expect(calls.filter(([input, init]) => String(input) === `${EL_DORADO_ORIGIN}/api/sessions` && init?.method === "PATCH")).toHaveLength(1);
    expect(calls.filter(([input]) => String(input) === `${EL_DORADO_ORIGIN}/api/sessions?items=*`)).toHaveLength(1);
    expect(calls.filter(([input]) => String(input).includes("/api/catalog_system/pub/products/search/"))).toHaveLength(2);

    const productCall = calls.find(([input]) => String(input).includes("/api/catalog_system/pub/products/search/"));
    expect(new Headers(productCall?.[1]?.headers).get("Cookie")).toBe("vtex_session=session; vtex_segment=segment");
  });

  it("elige el alias sano de Tienda Inglesa y lo incluye en sus mensajes", async () => {
    const canonicalUrl = "https://www.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const blueUrl = "https://prod-web-blue.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const greenUrl = "https://prod-web-green.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const queue = { sendBatch: vi.fn(async () => undefined) };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "tienda-inglesa" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: canonicalUrl,
        external_name: "Café",
        image_url: null,
      }]), { status: 200 });
      if (url.includes("/rest/v1/products")) return new Response(JSON.stringify([{
        id: "product-1",
        image_url: null,
        image_source_store_product_id: null,
        image_updated_at: null,
      }]), { status: 200 });
      if (url === blueUrl) return new Response("Service unavailable", { status: 503 });
      if (url === greenUrl) return new Response('{"W0032AV27ProductUI_PARM":{"Prices":[{"Label":"Precio","Price":123.45}]}}', { status: 200 });
      return new Response("Not found", { status: 404 });
    }));

    await dispatchDailyRun(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: queue,
      } as unknown as Env,
      new Date("2026-09-02T07:00:00Z"),
    );

    expect(queue.sendBatch).toHaveBeenCalledWith([{
      body: expect.objectContaining({
        product_id: "product-1",
        tienda_inglesa_fallback_origins: ["https://prod-web-green.tiendainglesa.com.uy", "https://prod-web-blue.tiendainglesa.com.uy"],
        tienda_inglesa_previously_failed_origins: ["https://prod-web-blue.tiendainglesa.com.uy"],
      }),
    }]);
  });

  it("usa el otro alias si el elegido para Tienda Inglesa falla durante el consumo", async () => {
    vi.useFakeTimers();
    const canonicalUrl = "https://www.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const blueUrl = "https://prod-web-blue.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const greenUrl = "https://prod-web-green.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const scraperUrls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === greenUrl) {
        scraperUrls.push(url);
        return new Response("Service unavailable", { status: 503 });
      }
      if (url === blueUrl) {
        scraperUrls.push(url);
        return new Response('{"W0032AV27ProductUI_PARM":{"Prices":[{"Label":"Precio","Price":123.45}]}}', { status: 200 });
      }
      if (url.includes("/rest/v1/prices")) return new Response(null, { status: 201 });
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const scrape = performScrapeMessage(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: { sendBatch: vi.fn() },
      } as unknown as Env,
      {
        run_id: "run-1",
        date: "2026-09-02",
        product_id: "product-1",
        product_image_url: null,
        tienda_inglesa_fallback_origins: ["https://prod-web-green.tiendainglesa.com.uy", "https://prod-web-blue.tiendainglesa.com.uy"],
        store_products: [{
          id: "store-product-1",
          product_id: "product-1",
          store_id: "store-1",
          location_id: null,
          url: canonicalUrl,
          external_name: "Café",
          image_url: null,
          store_slug: "tienda-inglesa",
        }],
      },
    );
    await vi.runAllTimersAsync();

    await expect(scrape).resolves.toEqual({ attempted: 1, saved: 1, failed: 0 });
    expect(scraperUrls).toEqual([greenUrl, greenUrl, greenUrl, blueUrl]);
    expect(scraperUrls).not.toContain(canonicalUrl);
  });

  it("no reintenta un alias que el dispatcher ya encontró caído", async () => {
    vi.useFakeTimers();
    const canonicalUrl = "https://www.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const blueUrl = "https://prod-web-blue.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const greenUrl = "https://prod-web-green.tiendainglesa.com.uy/supermercado/cafe.producto?1584835,,42";
    const scraperUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === greenUrl || url === blueUrl) {
        scraperUrls.push(url);
        return new Response("Service unavailable", { status: 503 });
      }
      return new Response("Not found", { status: 404 });
    }));

    const scrape = performScrapeMessage(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        SCRAPE_QUEUE: { sendBatch: vi.fn() },
      } as unknown as Env,
      {
        run_id: "run-1",
        date: "2026-09-02",
        product_id: "product-1",
        product_image_url: null,
        tienda_inglesa_fallback_origins: ["https://prod-web-green.tiendainglesa.com.uy", "https://prod-web-blue.tiendainglesa.com.uy"],
        tienda_inglesa_previously_failed_origins: ["https://prod-web-blue.tiendainglesa.com.uy"],
        store_products: [{
          id: "store-product-1",
          product_id: "product-1",
          store_id: "store-1",
          location_id: null,
          url: canonicalUrl,
          external_name: "Café",
          image_url: null,
          store_slug: "tienda-inglesa",
        }],
      },
    );
    const rejection = expect(scrape).rejects.toThrow("No se pudo leer ningún alias de Tienda Inglesa");
    await vi.runAllTimersAsync();

    await rejection;
    expect(scraperUrls).toEqual([greenUrl, greenUrl, greenUrl, blueUrl]);
  });

  it("mantiene el intervalo de Tienda Inglesa entre mensajes de Queue", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://example.test/tienda-inglesa") {
        return new Response('<div data-config="{&quot;WProductUI_PARM&quot;:{&quot;Prices&quot;:[{&quot;Label&quot;:&quot;Precio&quot;,&quot;Price&quot;:1299}]}}"></div>', { status: 200 });
      }
      if (url.includes("/rest/v1/prices")) return new Response(null, { status: 201 });
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      SCRAPE_QUEUE: { sendBatch: vi.fn() },
    } as unknown as Env;
    const message = {
      run_id: "run-1",
      date: "2026-09-02",
      product_id: "product-1",
      product_image_url: null,
      store_products: [{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: "https://example.test/tienda-inglesa",
        external_name: null,
        image_url: null,
        store_slug: "tienda-inglesa",
      }],
    } satisfies ScrapeQueueMessage;

    const first = performScrapeMessage(env, message);
    await vi.advanceTimersByTimeAsync(500);
    await first;

    const second = performScrapeMessage(env, { ...message, product_id: "product-2" });
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === message.store_products[0].url)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(500);
    await second;

    expect(fetchMock.mock.calls.filter(([input]) => String(input) === message.store_products[0].url)).toHaveLength(2);
  });
});
