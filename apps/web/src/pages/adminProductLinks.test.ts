import { describe, expect, it } from "vitest";
import { productLinksError, serializeProductLinks } from "./adminProductLinks";
import type { Store } from "../services/types";

const stores: Store[] = [
  { id: "disco", name: "Disco", slug: "disco" },
  { id: "tata", name: "Ta-Ta", slug: "tata" },
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
});
