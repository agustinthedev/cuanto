import type { ScrapeAttemptStatus, ScrapeRawResponse, StoreProductRecord } from "./types";

export interface RawResponseReference {
  objectKey: string;
  sha256: string;
  responseSizeBytes: number;
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function rawResponseObjectKey(
  runId: string,
  date: string,
  record: StoreProductRecord,
  scrapeStatus: ScrapeAttemptStatus,
  attemptId: string = crypto.randomUUID(),
): string {
  return [
    "raw",
    scrapeStatus,
    safePathSegment(date),
    safePathSegment(runId),
    safePathSegment(record.store_slug),
    safePathSegment(record.id),
    `${safePathSegment(attemptId)}.body.gz`,
  ].join("/");
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  const digestInput = new ArrayBuffer(value.byteLength);
  new Uint8Array(digestInput).set(value);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveRawResponse(
  bucket: R2Bucket,
  runId: string,
  date: string,
  record: StoreProductRecord,
  scrapeStatus: ScrapeAttemptStatus,
  rawResponse: ScrapeRawResponse,
): Promise<RawResponseReference> {
  const bodyBytes = new TextEncoder().encode(rawResponse.body);
  const sha256 = await sha256Hex(bodyBytes);
  const objectKey = rawResponseObjectKey(runId, date, record, scrapeStatus);
  const compressedBody = new Response(rawResponse.body).body?.pipeThrough(new CompressionStream("gzip"));
  if (!compressedBody) throw new Error("No se pudo preparar la respuesta para comprimir");

  await bucket.put(objectKey, compressedBody, {
    httpMetadata: {
      contentType: rawResponse.contentType ?? "application/octet-stream",
      contentEncoding: "gzip",
    },
    customMetadata: {
      sourceUrl: rawResponse.url,
      scrapeStatus,
      status: String(rawResponse.status),
      sha256,
    },
  });

  return { objectKey, sha256, responseSizeBytes: bodyBytes.byteLength };
}
