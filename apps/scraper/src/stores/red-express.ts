import { selectPriceCandidate } from "../price";
import type { PriceEvidence, ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromPayload, requireResponseTextSnapshot, scraperErrorWithResponse, ScraperError } from "./base";

interface RedExpressEnv {
  RED_EXPRESS_BASIC_AUTH?: string;
  RED_EXPRESS_LOCAL_ID?: string;
}

function withLocationContext(rawUrl: string, env: RedExpressEnv): string {
  const url = new URL(rawUrl);
  if (env.RED_EXPRESS_LOCAL_ID && !url.searchParams.has("local")) url.searchParams.set("local", env.RED_EXPRESS_LOCAL_ID);
  if (!url.searchParams.has("empresa")) url.searchParams.set("empresa", "8062");
  return url.toString();
}

export function parseRedExpressJson(payload: unknown): number {
  return parseRedExpressJsonWithEvidence(payload).price;
}

export function parseRedExpressJsonWithEvidence(payload: unknown): PriceEvidence & { price: number } {
  const prices: Array<{ path: string; value: unknown }> = [];
  const visit = (value: unknown, depth: number, path: string) => {
    if (depth > 6 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, depth + 1, `${path}[${index}]`));
      return;
    }
    const object = value as Record<string, unknown>;
    if ("precioUnitario" in object) prices.push({ path: `${path}.precioUnitario`, value: object.precioUnitario });
    if ("precio" in object) prices.push({ path: `${path}.precio`, value: object.precio });
    Object.entries(object).forEach(([key, child]) => visit(child, depth + 1, `${path}.${key}`));
  };
  visit(payload, 0, "json");
  return selectPriceCandidate(prices);
}

export const redExpressScraper: StoreScraper = {
  slug: "red-express",
  async scrape(record: StoreProductRecord, env: Env): Promise<ScrapeResult> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (env.RED_EXPRESS_BASIC_AUTH) {
      headers.Authorization = env.RED_EXPRESS_BASIC_AUTH.startsWith("Basic ") ? env.RED_EXPRESS_BASIC_AUTH : `Basic ${env.RED_EXPRESS_BASIC_AUTH}`;
    }
    const rawResponse = await requireResponseTextSnapshot(withLocationContext(record.url, env), { headers });
    let payload: unknown;
    try {
      payload = JSON.parse(rawResponse.body);
    } catch {
      throw new ScraperError("El producto de Red Express no devolvió JSON válido", rawResponse);
    }
    let parsed: PriceEvidence & { price: number };
    try {
      parsed = parseRedExpressJsonWithEvidence(payload);
    } catch (error) {
      throw scraperErrorWithResponse(error, rawResponse);
    }
    const { price, ...evidence } = parsed;
    return { price, source: "json", evidence, rawResponse, imageUrl: extractProductImageFromPayload(payload, record.url) };
  },
};
