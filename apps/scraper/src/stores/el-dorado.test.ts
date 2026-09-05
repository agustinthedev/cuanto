import { afterEach, describe, expect, it, vi } from "vitest";
import productPayload from "../fixtures/eldorado-product.json";
import type { ScrapeContext, StoreProductRecord } from "../types";
import { EL_DORADO_ORIGIN, EL_DORADO_REGION_ID, elDoradoScraper } from "./el-dorado";

const regionIdEncoded = btoa(EL_DORADO_REGION_ID);

const record = (id: string, url: string): StoreProductRecord => ({
  id,
  product_id: `product-${id}`,
  store_id: "store-el-dorado",
  location_id: null,
  url,
  external_name: null,
  image_url: null,
  store_slug: "el-dorado",
});

describe("adapter de El Dorado", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("configura Montevideo una vez por corrida y reutiliza la sesión regional", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === `${EL_DORADO_ORIGIN}/`) {
        return new Response("", { status: 200, headers: { "Set-Cookie": "vtex_session=session; Path=/" } });
      }
      if (url === `${EL_DORADO_ORIGIN}/api/sessions` && init?.method === "PATCH") {
        return new Response("", { status: 201, headers: { "Set-Cookie": "vtex_segment=segment; Path=/" } });
      }
      if (url === `${EL_DORADO_ORIGIN}/api/sessions?items=*`) {
        return new Response(JSON.stringify({ namespaces: { checkout: { regionId: { value: regionIdEncoded } } } }), { status: 200 });
      }
      if (url.includes("/api/catalog_system/pub/products/search/")) {
        return new Response(JSON.stringify(productPayload), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const context: ScrapeContext = {};
    const first = await elDoradoScraper.scrape(record("one", "https://www.eldorado.com.uy/queso-el-dorado-muzzarella-kg/p"), {} as Env, context);
    const second = await elDoradoScraper.scrape(record("two", "https://www.eldorado.com.uy/papa-rosada-kg/p"), {} as Env, context);

    expect(first).toEqual({
      price: 499,
      source: "json",
      imageUrl: "https://eldoradouy.vtexassets.com/arquivos/muzzarella.jpg",
    });
    expect(second.price).toBe(499);

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.filter(([input]) => String(input) === `${EL_DORADO_ORIGIN}/`)).toHaveLength(1);
    expect(calls.filter(([input, init]) => String(input) === `${EL_DORADO_ORIGIN}/api/sessions` && init?.method === "PATCH")).toHaveLength(1);
    expect(calls.filter(([input]) => String(input) === `${EL_DORADO_ORIGIN}/api/sessions?items=*`)).toHaveLength(1);
    expect(calls.filter(([input]) => String(input).includes("/api/catalog_system/pub/products/search/"))).toHaveLength(2);

    const patchCall = calls.find(([input, init]) => String(input) === `${EL_DORADO_ORIGIN}/api/sessions` && init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(new Headers(patchCall?.[1]?.headers).get("Cookie")).toBe("vtex_session=session");
    expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ public: { regionId: { value: regionIdEncoded } } });

    const productCall = calls.find(([input]) => String(input).includes("/api/catalog_system/pub/products/search/"));
    expect(new Headers(productCall?.[1]?.headers).get("Cookie")).toBe("vtex_session=session; vtex_segment=segment");
  });

  it("rechaza links que no pertenecen a El Dorado", async () => {
    await expect(elDoradoScraper.scrape(record("one", "https://www.tata.com.uy/arroz/p"), {} as Env)).rejects.toThrow("debe apuntar a www.eldorado.com.uy");
  });
});
