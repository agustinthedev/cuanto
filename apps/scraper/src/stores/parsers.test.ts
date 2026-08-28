import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import redFixture from "../fixtures/red-product.json";
import { parseDiscoHtml } from "./disco";
import { parseRedExpressJson } from "./red-express";
import { parseTiendaInglesaHtml } from "./tienda-inglesa";
import { extractTataSlug, parseTataGraphqlProduct, parseTataHtml } from "./tata";
import { extractProductImageFromHtml, extractProductImageFromPayload } from "./base";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

describe("adapters de supermercados", () => {
  it("extrae el precio original de Disco desde HTML server-rendered", () => {
    expect(parseDiscoHtml(fixture("disco-product.html"))).toBe(230);
  });

  it("prioriza el precio original de Disco en metadatos sobre precio y descuento promocionales", () => {
    expect(parseDiscoHtml(`
      <meta property="product:price:amount" content="1299.00">
      <div class="product-prices">
        <div class="price"><span class="mon">$</span><span class="val">197</span></div>
        <div class="lbl-dcto">20%</div>
      </div>
    `)).toBe(1299);
  });

  it("no usa un precio promocional como precio original de Disco si faltan señales explícitas", () => {
    expect(() => parseDiscoHtml(`
      <div class="price"><span class="mon">$</span><span class="val">197</span></div>
      <div class="lbl-dcto">20%</div>
    `)).toThrow("Disco no incluyó un precio original identificable");
  });

  it("extrae Tienda Inglesa con decimal uruguayo", () => {
    expect(parseTiendaInglesaHtml(fixture("tienda-product.html"))).toBe(149.9);
  });

  it("decodifica el bloque de precios actual de Tienda Inglesa y prioriza Antes", () => {
    expect(parseTiendaInglesaHtml(fixture("tienda-product-encoded.html"))).toBe(230);
  });

  it("extrae un decimal de Tienda Inglesa antes de la coma del siguiente campo JSON", () => {
    expect(parseTiendaInglesaHtml(
      '<div data-config="{&quot;W0032AV27ProductUI_PARM&quot;:{&quot;Prices&quot;:[{&quot;Label&quot;:&quot;Precio&quot;,&quot;Price&quot;:45.2,&quot;PriceStr&quot;:&quot;$ 45,20&quot;}]}}"></div>',
    )).toBe(45.2);
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

  it("extrae la imagen de producto desde metadatos HTML y resuelve rutas relativas", () => {
    expect(extractProductImageFromHtml(
      '<meta property="og:image" content="/media/coca-cola.jpg">',
      "https://www.disco.com.uy/product/coca-cola",
    )).toBe("https://www.disco.com.uy/media/coca-cola.jpg");
  });

  it("extrae la imagen de producto desde la respuesta JSON de una cadena", () => {
    expect(extractProductImageFromPayload({
      data: { product: { images: [{ url: "https://cdn.tata.com.uy/products/arroz.jpg" }] } },
    }, "https://www.tata.com.uy/arroz/p")).toBe("https://cdn.tata.com.uy/products/arroz.jpg");
  });
});
