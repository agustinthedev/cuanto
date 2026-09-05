import { describe, expect, it } from "vitest";
import { productLinksError, serializeProductLinks, serializeSuggestionLinks } from "./adminProductLinks";
import type { Store } from "../services/types";

const stores: Store[] = [
  { id: "disco", name: "Disco", slug: "disco", active: true },
  { id: "tata", name: "Ta-Ta", slug: "tata", active: true },
];

describe("product link validation", () => {
  it("allows empty chain fields when at least one URL is valid", () => {
    const links = [
      { storeId: "disco", url: "https://disco.example/producto" },
      { storeId: "tata", url: "" },
    ];

    expect(productLinksError(links, stores)).toBeNull();
    expect(serializeProductLinks(links)).toEqual([
      { store_id: "disco", url: "https://disco.example/producto" },
    ]);
  });

  it("requires at least one URL", () => {
    expect(productLinksError([
      { storeId: "disco", url: "" },
      { storeId: "tata", url: "  " },
    ], stores)).toBe("Ingresá al menos un link http(s) válido para guardar el producto.");
  });

  it("rejects a non-empty invalid URL", () => {
    expect(productLinksError([
      { storeId: "disco", url: "no-es-un-link" },
      { storeId: "tata", url: "https://tata.example/producto" },
    ], stores)).toBe("Ingresá un link http(s) válido para Disco.");
  });

  it("preserves links for stores hidden from the active form", () => {
    expect(serializeSuggestionLinks([
      { storeId: "disco", url: "https://disco.example/actualizado" },
      { storeId: "tata", url: "" },
    ], [
      { store_id: "disco", url: "https://disco.example/anterior" },
      { store_id: "tienda-inglesa", url: "https://tiendainglesa.example/producto" },
    ])).toEqual([
      { store_id: "disco", url: "https://disco.example/actualizado" },
      { store_id: "tienda-inglesa", url: "https://tiendainglesa.example/producto" },
    ]);
  });
});
