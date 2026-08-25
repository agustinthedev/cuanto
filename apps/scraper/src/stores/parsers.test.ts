import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import redFixture from "../fixtures/red-product.json";
import { parseDiscoHtml } from "./disco";
import { parseRedExpressJson } from "./red-express";
import { parseTiendaInglesaHtml } from "./tienda-inglesa";
import { extractTataSlug, parseTataGraphqlProduct, parseTataHtml } from "./tata";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

describe("adapters de supermercados", () => {
  it("extrae el precio original de Disco desde HTML server-rendered", () => {
    expect(parseDiscoHtml(fixture("disco-product.html"))).toBe(230);
  });

  it("extrae Tienda Inglesa con decimal uruguayo", () => {
    expect(parseTiendaInglesaHtml(fixture("tienda-product.html"))).toBe(149.9);
  });

  it("decodifica el bloque de precios actual de Tienda Inglesa y prioriza Antes", () => {
    expect(parseTiendaInglesaHtml(fixture("tienda-product-encoded.html"))).toBe(230);
  });

  it("extrae Red Express desde la respuesta JSON anidada", () => {
    expect(parseRedExpressJson(redFixture)).toBe(78);
  });

  it("extrae el precio original de Ta-Ta desde JSON-LD", () => {
    expect(extractTataSlug("https://www.tata.com.uy/leche-descremada-blancanube-1-lt/p")).toBe("leche-descremada-blancanube-1-lt");
    expect(parseTataHtml(fixture("tata-product.html"))).toBe(230);
  });

  it("prioriza el precio de lista visible de Ta-Ta sobre el JSON-LD desactualizado", () => {
    expect(parseTataHtml(fixture("tata-product-promo.html"))).toBe(230);
  });

  it("extrae el precio original del producto desde la API de Ta-Ta", () => {
    expect(parseTataGraphqlProduct({
      data: { product: { offers: { offers: [{ price: 207, listPrice: 230 }] } } },
    })).toBe(230);
  });
});
