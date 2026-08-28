import { describe, expect, it } from "vitest";
import { attachLatestPrices } from "./data";
import type { Product } from "./types";

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
      { product_id: "product-1", price: 120, store_name: "Ta-Ta" },
      { product_id: "product-1", price: 100, store_name: "Disco" },
      { product_id: "product-1", price: 0, store_name: "Invalid" },
    ])).toEqual([
      { ...products[0], current_price: 100, best_store: "Disco" },
      products[1],
    ]);
  });

  it("keeps products without a valid observation unchanged", () => {
    expect(attachLatestPrices(products, [
      { product_id: "product-2", price: Number.NaN, store_name: "Disco" },
      { product_id: "unknown", price: 80, store_name: "Ta-Ta" },
    ])).toEqual(products);
  });
});
