import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { requireResponseJson } from "./base";

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
  const prices: unknown[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 6 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    const object = value as Record<string, unknown>;
    if ("precioUnitario" in object) prices.push(object.precioUnitario);
    if ("precio" in object) prices.push(object.precio);
    Object.values(object).forEach((child) => visit(child, depth + 1));
  };
  visit(payload, 0);
  return extractJsonPrice(...prices);
}

export const redExpressScraper: StoreScraper = {
  slug: "red-express",
  async scrape(record: StoreProductRecord, env: Env): Promise<ScrapeResult> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (env.RED_EXPRESS_BASIC_AUTH) {
      headers.Authorization = env.RED_EXPRESS_BASIC_AUTH.startsWith("Basic ") ? env.RED_EXPRESS_BASIC_AUTH : `Basic ${env.RED_EXPRESS_BASIC_AUTH}`;
    }
    const payload = await requireResponseJson(withLocationContext(record.url, env), { headers });
    return { price: parseRedExpressJson(payload), source: "json" };
  },
};
