import { describe, expect, it } from "vitest";
import { buildProductSearchUrl, sortProducts } from "./productSearch";
import type { Product } from "./types";

const products: Product[] = [
  { id: "a", name: "Café", brand: null, quantity: 250, unit: "g", image_url: null, category: null, created_at: "2026-08-28", current_price: 289, comparison_count: 3 },
  { id: "b", name: "Aceite", brand: null, quantity: 1, unit: "L", image_url: null, category: null, created_at: "2026-08-27", current_price: 780, comparison_count: 2 },
  { id: "c", name: "Arroz", brand: null, quantity: 1, unit: "kg", image_url: null, category: null, created_at: "2026-08-26", comparison_count: 0 },
];

describe("product search helpers", () => {
  it("sorts priced products first and leaves products without prices at the end", () => {
    expect(sortProducts(products, "price-asc").map((product) => product.id)).toEqual(["a", "b", "c"]);
    expect(sortProducts(products, "price-desc").map((product) => product.id)).toEqual(["b", "a", "c"]);
  });

  it("builds a shareable URL with homepage filters", () => {
    expect(buildProductSearchUrl(" café molido ", "category-almacen", "price-asc")).toBe("/productos?q=caf%C3%A9+molido&category=category-almacen&sort=price-asc");
  });
});
