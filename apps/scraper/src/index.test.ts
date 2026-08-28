import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { runScrape } from "./index";

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
      if (url.startsWith("https://example.test/")) return new Response("<strong>$ 10</strong>", { status: 200 });
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const scrape = runScrape({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" }, new Date("2026-08-25T12:00:00Z"));
    await vi.runAllTimersAsync();
    await expect(scrape).resolves.toEqual({ attempted: 2, saved: 2, failed: 0 });
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
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
