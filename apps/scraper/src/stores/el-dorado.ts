import { extractJsonPrice } from "../price";
import type { ElDoradoSession, ScrapeContext, ScrapeResult, StoreProductRecord, StoreScraper } from "../types";
import { extractProductImageFromPayload, fetchWithRetry, ScraperError } from "./base";

export const EL_DORADO_ORIGIN = "https://www.eldorado.com.uy";
export const EL_DORADO_REGION_ID = "SW#eldoradouy2099";

const EL_DORADO_REGION_ID_ENCODED = btoa(EL_DORADO_REGION_ID);
const EL_DORADO_HOSTS = new Set(["eldorado.com.uy", "www.eldorado.com.uy"]);
const EL_DORADO_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)",
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const workerHeaders = headers as Headers & {
    getAll?: (name: string) => string[];
    getSetCookie?: () => string[];
  };
  if (typeof workerHeaders.getAll === "function") return workerHeaders.getAll("Set-Cookie");
  if (typeof workerHeaders.getSetCookie === "function") return workerHeaders.getSetCookie();

  const combined = headers.get("Set-Cookie");
  return combined ? combined.split(/,(?=\s*[^;,=\s]+=[^;,=]+)/g) : [];
}

function mergeCookieHeader(existing: string, setCookies: string[]): string {
  const cookies = new Map<string, string>();
  for (const part of existing.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  for (const line of setCookies) {
    const firstPart = line.split(";", 1)[0];
    const separator = firstPart.indexOf("=");
    if (separator > 0) cookies.set(firstPart.slice(0, separator).trim(), firstPart.slice(separator + 1).trim());
  }
  return Array.from(cookies.entries()).map(([name, value]) => `${name}=${value}`).join("; ");
}

function headersWithCookie(cookie: string): HeadersInit {
  return cookie ? { ...EL_DORADO_HEADERS, Cookie: cookie } : EL_DORADO_HEADERS;
}

export function extractElDoradoSlug(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ScraperError("La URL de El Dorado no es válida");
  }

  if (url.protocol !== "https:" || !EL_DORADO_HOSTS.has(url.hostname.toLowerCase())) {
    throw new ScraperError("La URL de El Dorado debe apuntar a www.eldorado.com.uy");
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.at(-1)?.toLowerCase() === "p") segments.pop();
  const slug = segments.at(-1);
  if (!slug) throw new ScraperError("La URL de El Dorado no contiene un slug de producto");

  try {
    return decodeURIComponent(slug);
  } catch {
    throw new ScraperError("La URL de El Dorado contiene un slug inválido");
  }
}

function productApiUrl(slug: string): string {
  return `${EL_DORADO_ORIGIN}/api/catalog_system/pub/products/search/${encodeURIComponent(slug)}/p`;
}

export function parseElDoradoProduct(payload: unknown): number {
  const products = Array.isArray(payload) ? payload : [];
  const product = asRecord(products[0]);
  const items = product?.items;
  const item = Array.isArray(items) ? asRecord(items[0]) : null;
  const sellers = item?.sellers;
  const seller = Array.isArray(sellers) ? asRecord(sellers[0]) : null;
  const offer = asRecord(seller?.commertialOffer);
  if (!offer) throw new ScraperError("El Dorado no devolvió una oferta para el producto");

  // Keep the original/list price, matching the current scraper contract.
  return extractJsonPrice(offer.ListPrice, offer.Price);
}

async function createRegionalSession(): Promise<ElDoradoSession> {
  let cookie = "";
  const bootstrap = await fetchWithRetry(`${EL_DORADO_ORIGIN}/`, { headers: EL_DORADO_HEADERS });
  if (!bootstrap.ok) throw new ScraperError(`El Dorado no inició la sesión regional: HTTP ${bootstrap.status}`);
  cookie = mergeCookieHeader(cookie, getSetCookieHeaders(bootstrap.headers));
  await bootstrap.arrayBuffer();

  const regionResponse = await fetchWithRetry(`${EL_DORADO_ORIGIN}/api/sessions`, {
    method: "PATCH",
    headers: { ...headersWithCookie(cookie), "Content-Type": "application/json" },
    body: JSON.stringify({ public: { regionId: { value: EL_DORADO_REGION_ID_ENCODED } } }),
  });
  if (!regionResponse.ok) throw new ScraperError(`El Dorado no aceptó la región: HTTP ${regionResponse.status}`);
  cookie = mergeCookieHeader(cookie, getSetCookieHeaders(regionResponse.headers));
  await regionResponse.arrayBuffer();

  const verificationResponse = await fetchWithRetry(`${EL_DORADO_ORIGIN}/api/sessions?items=*`, { headers: headersWithCookie(cookie) });
  if (!verificationResponse.ok) throw new ScraperError(`El Dorado no verificó la región: HTTP ${verificationResponse.status}`);

  let payload: unknown;
  try {
    payload = await verificationResponse.json();
  } catch {
    throw new ScraperError("La sesión regional de El Dorado no devolvió JSON válido");
  }

  const namespaces = asRecord(asRecord(payload)?.namespaces);
  const checkout = asRecord(namespaces?.checkout);
  const returnedRegionId = asRecord(checkout?.regionId)?.value;
  if (returnedRegionId !== EL_DORADO_REGION_ID_ENCODED) {
    throw new ScraperError("El Dorado devolvió una región distinta a Centro, Barrio Sur y Ciudad Vieja");
  }

  return { origin: EL_DORADO_ORIGIN, cookie };
}

async function regionalSession(context: ScrapeContext): Promise<ElDoradoSession> {
  if (context.elDoradoSession) return context.elDoradoSession;
  const session = await createRegionalSession();
  context.elDoradoSession = session;
  return session;
}

export const elDoradoScraper: StoreScraper = {
  slug: "el-dorado",
  async scrape(record: StoreProductRecord, _env: Env, context: ScrapeContext = {}): Promise<ScrapeResult> {
    const slug = extractElDoradoSlug(record.url);
    const session = await regionalSession(context);
    const payload = await fetchWithRetry(productApiUrl(slug), { headers: headersWithCookie(session.cookie) })
      .then(async (response) => {
        if (!response.ok) throw new ScraperError(`No se pudo leer el producto de El Dorado: HTTP ${response.status}`);
        try {
          return await response.json();
        } catch {
          throw new ScraperError("El producto de El Dorado no devolvió JSON válido");
        }
      });

    return {
      price: parseElDoradoProduct(payload),
      source: "json",
      imageUrl: extractProductImageFromPayload(payload, record.url),
    };
  },
};
