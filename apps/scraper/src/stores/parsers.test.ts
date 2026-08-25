import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import redFixture from "../fixtures/red-product.json";
import { parseDiscoHtml } from "./disco";
import { parseRedExpressJson } from "./red-express";
import { parseTiendaInglesaHtml } from "./tienda-inglesa";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");

describe("adapters de supermercados", () => {
  it("extrae Disco desde HTML server-rendered", () => {
    expect(parseDiscoHtml(fixture("disco-product.html"))).toBe(1299);
  });

  it("extrae Tienda Inglesa con decimal uruguayo", () => {
    expect(parseTiendaInglesaHtml(fixture("tienda-product.html"))).toBe(129.9);
  });

  it("extrae Red Express desde la respuesta JSON anidada", () => {
    expect(parseRedExpressJson(redFixture)).toBe(78);
  });
});
