import { describe, expect, it } from "vitest";
import { matchesAdminProductSearch } from "./adminProductSearch";
import type { AdminProduct } from "../services/types";

const product: AdminProduct = {
  id: "product-1",
  name: "Café tostado molido clásico",
  brand: "El Chaná",
  quantity: 250,
  unit: "g",
  image_url: null,
  category: { id: "category-1", name: "Almacén", slug: "almacen" },
  created_at: "2026-08-28T09:00:00Z",
  links: [],
  tags: [{ id: "tag-1", name: "Orgánico" }],
  has_location_scoped_links: false,
};

describe("matchesAdminProductSearch", () => {
  it("matches name, brand, category and tags", () => {
    expect(matchesAdminProductSearch(product, "tostado")).toBe(true);
    expect(matchesAdminProductSearch(product, "chaná")).toBe(true);
    expect(matchesAdminProductSearch(product, "almacen")).toBe(true);
    expect(matchesAdminProductSearch(product, "organico")).toBe(true);
  });

  it("is accent-insensitive and returns every product for an empty query", () => {
    expect(matchesAdminProductSearch(product, "CAFÉ")).toBe(true);
    expect(matchesAdminProductSearch(product, "   ")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesAdminProductSearch(product, "detergente")).toBe(false);
  });
});
