const USER_AGENT = "Cuanto.uy price tracker/0.1 (+https://cuanto.uy)";
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_DELAY_MS = 1_000;
const FALLBACK_ORIGINS = [
  "https://prod-web-blue.tiendainglesa.com.uy",
  "https://prod-web-green.tiendainglesa.com.uy",
];
const DEFAULT_URLS = [
  "https://www.tiendainglesa.com.uy/supermercado/fideos-fusilli-barilla-500-gr.producto?100512,,42",
  "https://www.tiendainglesa.com.uy/supermercado/aceite-de-girasol-alto-oleico-optimo-900-ml.producto?10518,,42",
  "https://www.tiendainglesa.com.uy/supermercado/manteca-con-sal-conaprole-200-gr.producto?1489,,42",
];

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;|&#160;/gi, " ");
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

function parseNumericPrice(value) {
  const normalized = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,\.\-]/g, "")
    .trim();

  if (!normalized || normalized.includes("-")) throw new Error("precio inválido");

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  let parsed;

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

  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("precio inválido");
  return Math.round(parsed * 100) / 100;
}

function extractPriceFromText(text) {
  const matches = text.match(/(?:U\$S|\$)\s*[\d.\s]+(?:,\d{1,2})?/gi) ?? [];
  const prices = matches.flatMap((match) => {
    try {
      return [parseNumericPrice(match)];
    } catch {
      return [];
    }
  });

  if (prices.length === 0) throw new Error("no se encontró precio");
  return prices[prices.length - 1];
}

function parseTiendaInglesaPrice(html) {
  const normalizedHtml = decodeHtmlEntities(html);
  const prices = normalizedHtml.match(/"[^\"]+ProductUI_PARM"\s*:\s*\{[\s\S]*?"Prices"\s*:\s*\[([^\]]*)\]/i)?.[1];
  const originalPrice = prices?.match(/"Label"\s*:\s*"Antes[^\"]*"\s*,\s*"Price"\s*:\s*([\d]+(?:[.,]\d+)?)/i)?.[1];
  if (originalPrice) return parseNumericPrice(originalPrice.replace(",", "."));

  const regularPrice = prices?.match(/"Label"\s*:\s*"Precio[^\"]*"\s*,\s*"Price"\s*:\s*([\d]+(?:[.,]\d+)?)/i)?.[1];
  if (regularPrice) return parseNumericPrice(regularPrice.replace(",", "."));

  return extractPriceFromText(htmlToText(html));
}

function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "tiendainglesa.com.uy" || url.hostname.endsWith(".tiendainglesa.com.uy"));
  } catch {
    return false;
  }
}

function replaceOrigin(sourceUrl, origin) {
  const source = new URL(sourceUrl);
  const target = new URL(origin);
  source.protocol = target.protocol;
  source.host = target.host;
  return source.toString();
}

function splitConfiguredUrls(input) {
  return input
    .split(/(?:\r?\n)+|(?=https:\/\/)/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function configuredUrls() {
  const input = process.env.TI_TEST_URLS?.trim();
  const urls = input ? splitConfiguredUrls(input) : DEFAULT_URLS;

  if (urls.length === 0) throw new Error("No se configuraron URLs para probar");
  if (urls.some((url) => !isAllowedUrl(url))) {
    throw new Error("Todas las URLs deben pertenecer a tiendainglesa.com.uy y usar HTTPS");
  }
  return [...new Set(urls)];
}

async function probe(sourceUrl, targetUrl) {
  const startedAt = Date.now();
  const result = {
    sourceUrl,
    targetUrl,
    status: null,
    bytes: 0,
    productData: false,
    jsonLd: false,
    parsedPrice: null,
    error: null,
    durationMs: 0,
  };

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    result.status = response.status;
    const html = await response.text();
    result.bytes = Buffer.byteLength(html, "utf8");
    result.productData = /"[^\"]+ProductUI_PARM"\s*:\s*\{/i.test(decodeHtmlEntities(html));
    result.jsonLd = /application\/ld\+json/i.test(html);

    if (response.ok && result.productData) {
      try {
        result.parsedPrice = parseTiendaInglesaPrice(html);
      } catch (error) {
        result.error = `precio: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

function formatResult(result) {
  const price = result.parsedPrice === null ? "-" : String(result.parsedPrice);
  const error = result.error ? ` error=${JSON.stringify(result.error)}` : "";
  return [
    `source=${result.sourceUrl}`,
    `target=${result.targetUrl}`,
    `status=${result.status ?? "network-error"}`,
    `bytes=${result.bytes}`,
    `product_data=${result.productData}`,
    `json_ld=${result.jsonLd}`,
    `original_price=${price}`,
    `duration_ms=${result.durationMs}${error}`,
  ].join(" ");
}

const urls = configuredUrls();
const results = [];

console.log(`Tienda Inglesa probe: ${urls.length} source URL(s), ${FALLBACK_ORIGINS.length + 1} origin(s) each`);
console.log(`User-Agent: ${USER_AGENT}`);

for (const sourceUrl of urls) {
  const origins = [...new Set([new URL(sourceUrl).origin, ...FALLBACK_ORIGINS])];
  for (const origin of origins) {
    const targetUrl = replaceOrigin(sourceUrl, origin);
    const result = await probe(sourceUrl, targetUrl);
    results.push(result);
    console.log(formatResult(result));
    await sleep(REQUEST_DELAY_MS);
  }
}

const successfulSources = new Set(
  results
    .filter((result) => result.status === 200 && result.productData && result.parsedPrice !== null)
    .map((result) => result.sourceUrl),
);
const failedSources = urls.filter((url) => !successfulSources.has(url));

console.log(`Summary: ${successfulSources.size}/${urls.length} source URL(s) had at least one usable origin`);
if (failedSources.length > 0) {
  console.error("Source URL(s) without a usable origin:");
  failedSources.forEach((url) => console.error(`- ${url}`));
  process.exitCode = 1;
}
