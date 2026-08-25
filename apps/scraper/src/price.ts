export class InvalidPriceError extends Error {
  constructor(message = "El precio no es válido") {
    super(message);
    this.name = "InvalidPriceError";
  }
}

function toFinitePositive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new InvalidPriceError();
  }

  return Math.round(value * 100) / 100;
}

export function parseNumericPrice(value: unknown): number {
  if (typeof value === "number") {
    return toFinitePositive(value);
  }

  if (typeof value !== "string") {
    throw new InvalidPriceError();
  }

  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,\.\-]/g, "")
    .trim();

  if (!normalized || normalized.includes("-")) {
    throw new InvalidPriceError();
  }

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");

  let parsed: number;
  if (commaIndex >= 0) {
    const integerPart = normalized.slice(0, commaIndex).replace(/[.]/g, "");
    const decimalPart = normalized.slice(commaIndex + 1).replace(/[.]/g, "");
    parsed = Number(`${integerPart}.${decimalPart}`);
  } else if (dotIndex >= 0) {
    const decimalLength = normalized.length - dotIndex - 1;
    const leftLength = dotIndex;
    parsed = decimalLength === 2 && leftLength <= 3
      ? Number(normalized)
      : Number(normalized.replace(/[.]/g, ""));
  } else {
    parsed = Number(normalized);
  }

  return toFinitePositive(parsed);
}

export function extractPriceFromText(text: string): number {
  const matches = text.match(/(?:U\$S|\$)\s*[\d.\s]+(?:,\d{1,2})?/gi) ?? [];
  const prices = matches
    .map((match) => {
      try {
        return parseNumericPrice(match);
      } catch {
        return null;
      }
    })
    .filter((price): price is number => price !== null);

  if (prices.length === 0) {
    throw new InvalidPriceError("No se encontró un precio positivo en la respuesta");
  }

  // Product pages can show a cart total before the product card. The final
  // positive currency value is the product's displayed price for this MVP.
  return prices[prices.length - 1];
}

export function extractJsonPrice(...values: unknown[]): number {
  for (const value of values) {
    try {
      return parseNumericPrice(value);
    } catch {
      // Try the next source field.
    }
  }

  throw new InvalidPriceError("La respuesta no contiene un precio positivo");
}
