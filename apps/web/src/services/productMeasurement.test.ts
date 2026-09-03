import { describe, expect, it } from "vitest";
import { isProductUnit, normalizeProductQuantity, parseProductQuantity, productMeasurementError } from "./productMeasurement";

describe("product measurement helpers", () => {
  it("accepts the supported measurement units", () => {
    expect(isProductUnit("kg")).toBe(true);
    expect(isProductUnit("ml")).toBe(true);
    expect(isProductUnit("pack")).toBe(false);
  });

  it("parses positive decimal quantities using either decimal separator", () => {
    expect(parseProductQuantity("1.5")).toBe(1.5);
    expect(parseProductQuantity("0,75")).toBe(0.75);
    expect(parseProductQuantity("0")).toBeNull();
    expect(parseProductQuantity("0.0005")).toBeNull();
  });

  it("normalizes equivalent quantities to the database precision", () => {
    expect([1, 1.0, 1.000].map(normalizeProductQuantity)).toEqual([1, 1, 1]);
    expect(normalizeProductQuantity(1.2345)).toBe(1.235);
  });

  it("returns a validation message for invalid measurements", () => {
    expect(productMeasurementError("", "kg")).toBe("Ingresá una cantidad mayor o igual a 0,001.");
    expect(productMeasurementError("2", "pack")).toBe("Seleccioná una unidad de medida válida.");
    expect(productMeasurementError("2.5", "L")).toBeNull();
  });
});
