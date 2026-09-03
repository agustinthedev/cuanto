export const PRODUCT_UNIT_OPTIONS = [
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "g", label: "Gramos (g)" },
  { value: "L", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "un", label: "Unidades" },
] as const;

export type ProductUnit = (typeof PRODUCT_UNIT_OPTIONS)[number]["value"];
export const MIN_PRODUCT_QUANTITY = 0.001;

const productUnitValues = new Set<string>(PRODUCT_UNIT_OPTIONS.map((option) => option.value));

export function isProductUnit(value: unknown): value is ProductUnit {
  return typeof value === "string" && productUnitValues.has(value);
}

export function parseProductQuantity(value: string): number | null {
  const normalizedValue = value.trim().replace(",", ".");
  if (!normalizedValue) return null;

  const quantity = Number(normalizedValue);
  return Number.isFinite(quantity) && quantity >= MIN_PRODUCT_QUANTITY ? quantity : null;
}

export function productMeasurementError(quantity: string, unit: string): string | null {
  if (!parseProductQuantity(quantity)) return "Ingresá una cantidad mayor o igual a 0,001.";
  if (!isProductUnit(unit)) return "Seleccioná una unidad de medida válida.";
  return null;
}
