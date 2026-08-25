import { describe, expect, it, vi } from "vitest";
import { runScrape } from "./index";

describe("ejecución diaria", () => {
  it("guarda una observación usando upsert por producto y fecha", async () => {
    const savedBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/rest/v1/stores")) return new Response(JSON.stringify([{ id: "store-1", slug: "disco" }]), { status: 200 });
      if (url.includes("/rest/v1/store_products")) return new Response(JSON.stringify([{
        id: "store-product-1",
        product_id: "product-1",
        store_id: "store-1",
        location_id: null,
        url: "https://example.test/product",
        external_name: null,
      }]), { status: 200 });
      if (url === "https://example.test/product") return new Response("<main><h1>Producto</h1><strong>$ 1.299</strong></main>", { status: 200 });
      if (url.includes("/rest/v1/prices")) {
        savedBodies.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 201 });
      }
      return new Response("Not found", { status: 404 });
    }));

    const result = await runScrape({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" }, new Date("2026-08-25T12:00:00Z"));
    expect(result).toEqual({ attempted: 1, saved: 1, failed: 0 });
    expect(savedBodies).toEqual([{ store_product_id: "store-product-1", price: 1299, date: "2026-08-25", scraped_at: expect.any(String) }]);
    const calledUrls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes("on_conflict=store_product_id,date"))).toBe(true);
    vi.unstubAllGlobals();
  });
});
