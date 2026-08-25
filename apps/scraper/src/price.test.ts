import { describe, expect, it } from "vitest";
import { extractPriceFromText, parseNumericPrice } from "./price";

describe("precios uruguayos", () => {
  it("interpreta puntos como separador de miles", () => {
    expect(parseNumericPrice("$ 1.299")).toBe(1299);
  });

  it("mantiene los decimales con coma", () => {
    expect(parseNumericPrice("$ 129,90")).toBe(129.9);
  });

  it("rechaza cero y negativos", () => {
    expect(() => parseNumericPrice("$ 0")).toThrow();
    expect(() => parseNumericPrice("$ -25")).toThrow();
  });

  it("toma el último precio positivo de un bloque de producto", () => {
    expect(extractPriceFromText("Carrito $ 0,00 Producto $ 249")).toBe(249);
  });
});
