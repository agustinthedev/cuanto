import { fetchWithRetry, ScraperError } from "./stores/base";
import type { RawResponseReference } from "./raw-responses";
import type { ScrapeAttemptUpsert, ScrapeRawResponse, ScrapeResult, StoreProductRecord } from "./types";

interface ScrapeAttemptInput {
  runId: string;
  date: string;
  record: StoreProductRecord;
  attemptedAt: string;
  status: ScrapeAttemptUpsert["status"];
  result?: ScrapeResult;
  rawResponse?: ScrapeRawResponse;
  rawReference?: RawResponseReference;
  error?: unknown;
}

function errorMessage(error: unknown): string | null {
  if (error === undefined || error === null) return null;
  return error instanceof Error ? error.message : String(error);
}

function responseSizeBytes(rawResponse: ScrapeRawResponse | undefined): number | null {
  return rawResponse ? new TextEncoder().encode(rawResponse.body).byteLength : null;
}

export function buildScrapeAttempt(input: ScrapeAttemptInput): ScrapeAttemptUpsert {
  const rawResponse = input.rawResponse ?? input.result?.rawResponse;
  return {
    run_id: input.runId,
    product_id: input.record.product_id,
    store_product_id: input.record.id,
    store_id: input.record.store_id,
    date: input.date,
    attempted_at: input.attemptedAt,
    status: input.status,
    source_type: input.result?.source ?? (input.error instanceof ScraperError ? input.error.source ?? null : null),
    source_url: input.record.url,
    response_url: rawResponse?.url ?? null,
    http_status: rawResponse?.status ?? null,
    content_type: rawResponse?.contentType ?? null,
    response_size_bytes: input.rawReference?.responseSizeBytes ?? responseSizeBytes(rawResponse),
    response_sha256: input.rawReference?.sha256 ?? null,
    raw_object_key: input.rawReference?.objectKey ?? null,
    price: input.result?.price ?? null,
    selected_path: input.result?.evidence.selectedPath ?? null,
    candidates: input.result?.evidence.candidates ?? [],
    error: errorMessage(input.error),
  };
}

function apiUrl(env: Env): string {
  return `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/scrape_attempts`;
}

function apiHeaders(env: Env): Headers {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  });
}

export async function saveScrapeAttempts(env: Env, rows: ScrapeAttemptUpsert[]): Promise<void> {
  if (rows.length === 0) return;

  const response = await fetchWithRetry(apiUrl(env), {
    method: "POST",
    headers: apiHeaders(env),
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`No se pudieron guardar los intentos de scraping: HTTP ${response.status} ${await response.text()}`);
}
