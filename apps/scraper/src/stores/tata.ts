import { extractJsonPrice } from "../price";
import type { ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromPayload, requireResponseJson } from "./base";

const TATA_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
};

const TATA_MONTEVIDEO_SESSION = {
  currency: { code: "$", symbol: "$" },
  locale: "es-UY",
  channel: JSON.stringify({ salesChannel: "4", regionId: "" }),
  country: "URY",
  postalCode: "11800",
  person: null,
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function tataGraphqlUrl(rawUrl: string, operationName: string, variables: unknown): string {
  const url = new URL("/api/graphql", rawUrl);
  url.searchParams.set("operationName", operationName);
  url.searchParams.set("variables", JSON.stringify(variables));
  return url.toString();
}

export function extractTataSlug(rawUrl: string): string {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "p") segments.pop();
  const slug = segments.at(-1);
  if (!slug) throw new Error("La URL de Ta-Ta no contiene un slug de producto");
  return decodeURIComponent(slug);
}

function extractTataDataValue(html: string, testId: string): string | undefined {
  const element = html.match(new RegExp(`<[^>]*data-testid=["']${testId}["'][^>]*>`, "i"))?.[0];
  return element?.match(/data-value=["']([^"']+)["']/i)?.[1];
}

export function parseTataHtml(html: string): number {
  const listPrice = extractTataDataValue(html, "list-price");
  const displayedPrice = extractTataDataValue(html, "price");
  if (listPrice || displayedPrice) return extractJsonPrice(listPrice, displayedPrice);

  const prices: unknown[] = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scripts) {
    try {
      const payload = JSON.parse(match[1]) as Record<string, unknown>;
      const offers = payload.offers;
      const offerList: unknown[] = offers && typeof offers === "object" && Array.isArray((offers as Record<string, unknown>).offers)
        ? (offers as Record<string, unknown>).offers as unknown[]
        : offers && typeof offers === "object" ? [offers] : [];

      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const offerRecord = offer as Record<string, unknown>;
        prices.push(offerRecord.listPrice, offerRecord.price);
      }
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks and keep looking.
    }
  }

  if (prices.length === 0) throw new Error("Ta-Ta no incluyó el precio en el HTML");
  return extractJsonPrice(...prices);
}

export function parseTataGraphqlProduct(payload: unknown): number {
  const data = asRecord(asRecord(payload)?.data);
  const product = asRecord(data?.product);
  const offers = asRecord(product?.offers);
  const offerList = offers?.offers;
  const firstOffer = Array.isArray(offerList) ? asRecord(offerList[0]) : null;

  if (!firstOffer) throw new Error("Ta-Ta no devolvió ofertas para el producto");
  return extractJsonPrice(firstOffer.listPrice, firstOffer.price);
}

async function fetchTataMontevideoChannel(rawUrl: string): Promise<{ channel: string; locale: string }> {
  const payload = await requireResponseJson(tataGraphqlUrl(rawUrl, "ValidateSession", {
    session: TATA_MONTEVIDEO_SESSION,
    search: "",
  }), { headers: TATA_HEADERS });
  const session = asRecord(asRecord(payload)?.data)?.validateSession;
  const channel = asRecord(session)?.channel;
  const locale = asRecord(session)?.locale;

  if (typeof channel !== "string" || typeof locale !== "string") {
    throw new Error("Ta-Ta no devolvió el contexto de Montevideo");
  }

  return { channel, locale };
}

export const tataScraper: StoreScraper = {
  slug: "ta-ta",
  async scrape(record: StoreProductRecord): Promise<ScrapeResult> {
    const slug = extractTataSlug(record.url);
    const session = await fetchTataMontevideoChannel(record.url);
    const payload = await requireResponseJson(tataGraphqlUrl(record.url, "BrowserProductQuery", {
      locator: [
        { key: "slug", value: slug },
        { key: "channel", value: session.channel },
        { key: "locale", value: session.locale },
      ],
    }), { headers: TATA_HEADERS });

    return { price: parseTataGraphqlProduct(payload), source: "json", imageUrl: extractProductImageFromPayload(payload, record.url) };
  },
};
