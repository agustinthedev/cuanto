import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

import { attachLatestPrices, createProduct, getAdminStores, getHomepageProducts, getHomepageStats, normalizeAdminAnalytics, normalizeAdminAnalyticsContext } from "./data";
import type { Product } from "./types";

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

const products: Product[] = [
  {
    id: "product-1",
    name: "Aceite de oliva",
    brand: null,
    quantity: 1,
    unit: "L",
    image_url: null,
    category: null,
    created_at: "2026-08-28T09:00:00Z",
  },
  {
    id: "product-2",
    name: "Café",
    brand: null,
    quantity: 250,
    unit: "g",
    image_url: null,
    category: null,
    created_at: "2026-08-28T09:00:00Z",
  },
];

describe("attachLatestPrices", () => {
  it("attaches the lowest valid latest price and its store to each product", () => {
    expect(attachLatestPrices(products, [
      { product_id: "product-1", price: 120, store_name: "Ta-Ta", date: "2026-09-10" },
      { product_id: "product-1", price: 100, store_name: "Disco", date: "2026-09-09" },
      { product_id: "product-1", price: 0, store_name: "Invalid", date: "2026-09-10" },
    ], "2026-09-10")).toEqual([
      { ...products[0], current_price: 100, best_store: "Disco", comparison_count: 2 },
      products[1],
    ]);
  });

  it("counts distinct chains with a valid latest price", () => {
    expect(attachLatestPrices(products, [
      { product_id: "product-1", price: 120, store_name: "Ta-Ta", date: "2026-09-10" },
      { product_id: "product-1", price: 118, store_name: "Ta-Ta", date: "2026-09-09" },
      { product_id: "product-1", price: 130, store_name: "Disco", date: "2026-09-10" },
    ], "2026-09-10")[0]).toMatchObject({ comparison_count: 2 });
  });

  it("keeps products without a valid observation unchanged", () => {
    expect(attachLatestPrices(products, [
      { product_id: "product-2", price: Number.NaN, store_name: "Disco", date: "2026-09-10" },
      { product_id: "unknown", price: 80, store_name: "Ta-Ta", date: "2026-09-10" },
    ], "2026-09-10")).toEqual(products);
  });

  it("does not expose stale observations as current prices", () => {
    expect(attachLatestPrices(products, [
      { product_id: "product-1", price: 100, store_name: "Disco", date: "2026-09-08" },
    ], "2026-09-10")).toEqual(products);
  });
});

describe("getHomepageStats", () => {
  it("uses the database aggregate for active stores", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => Promise.resolve({ count: 1, error: null })),
    }));
    mockRpc.mockResolvedValueOnce({ data: 2, error: null });

    await expect(getHomepageStats()).resolves.toEqual({ products: 1, stores: 2, observations: 1, days: 1 });
    expect(mockRpc).toHaveBeenCalledWith("count_active_stores");
  });
});

describe("createProduct", () => {
  it("sends the brand to the direct product creation RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: "product-1", error: null });

    await expect(createProduct("Yerba mate", "Canarias", "category-1", 1, "kg", [
      { store_id: "store-1", url: "https://example.test/yerba" },
    ])).resolves.toBe("product-1");

    expect(mockRpc).toHaveBeenCalledWith("create_product_with_links", {
      p_name: "Yerba mate",
      p_brand: "Canarias",
      p_category_id: "category-1",
      p_quantity: 1,
      p_unit: "kg",
      p_links: [{ store_id: "store-1", url: "https://example.test/yerba" }],
      p_tag_ids: [],
    });
  });
});

describe("getHomepageProducts", () => {
  it("returns the exact match count even when the homepage rows are limited", async () => {
    const productRows = Array.from({ length: 25 }, (_, index) => ({
      id: `product-${index + 1}`,
      name: `Product ${index + 1}`,
      brand: null,
      quantity: 1,
      unit: "un",
      image_url: null,
      category: null,
      created_at: "2026-08-28T09:00:00Z",
    }));
    const productQuery = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      ilike: vi.fn(),
    };
    productQuery.select.mockReturnValue(productQuery);
    productQuery.order.mockReturnValue(productQuery);
    productQuery.ilike.mockReturnValue(productQuery);
    productQuery.limit.mockResolvedValue({ data: productRows.slice(0, 24), count: 25, error: null });
    const priceQuery = {
      select: vi.fn(),
      in: vi.fn(),
    };
    priceQuery.select.mockReturnValue(priceQuery);
    priceQuery.in.mockResolvedValue({ data: [], error: null });
    mockFrom.mockImplementation((table: string) => table === "products" ? productQuery : priceQuery);

    await expect(getHomepageProducts({ search: "product" })).resolves.toMatchObject({ total: 25, products: expect.any(Array) });
    expect(productQuery.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(productQuery.limit).toHaveBeenCalledWith(24);
  });
});

describe("getAdminStores", () => {
  it("requests only active stores", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [{ id: "store-disco", name: "Disco", slug: "disco", active: true }],
      error: null,
    });
    mockFrom.mockReturnValue(query);

    await expect(getAdminStores()).resolves.toEqual([{ id: "store-disco", name: "Disco", slug: "disco", active: true }]);
    expect(mockFrom).toHaveBeenCalledWith("stores");
    expect(query.select).toHaveBeenCalledWith("id,name,slug,active");
    expect(query.eq).toHaveBeenCalledWith("active", true);
  });
});

describe("normalizeAdminAnalytics", () => {
  it("normalizes email capture metrics for the admin dashboard", () => {
    const analytics = normalizeAdminAnalytics({
      summary: {
        email_capture_shown: 10,
        email_capture_submitted: 3,
        email_capture_dismissed: 6,
        email_capture_conversion_percentage: 30,
      },
    }, "30d");

    expect(analytics.summary).toMatchObject({
      emailCaptureShown: 10,
      emailCaptureSubmitted: 3,
      emailCaptureDismissed: 6,
      emailCaptureConversionPercentage: 30,
    });
  });

  it("normalizes captured visitor context dimensions", () => {
    expect(normalizeAdminAnalyticsContext({
      devices: [{ value: "mobile", visitors: 4 }],
      browsers: [{ value: "Safari", visitors: 2 }],
      operating_systems: [{ value: "iOS", visitors: 2 }],
      locales: [{ value: "es-UY", visitors: 3 }],
      countries: [{ value: "unknown", visitors: 4 }],
    })).toEqual({
      devices: [{ value: "mobile", visitors: 4 }],
      browsers: [{ value: "Safari", visitors: 2 }],
      operatingSystems: [{ value: "iOS", visitors: 2 }],
      locales: [{ value: "es-UY", visitors: 3 }],
      countries: [{ value: "unknown", visitors: 4 }],
    });
  });
});
