import { describe, expect, it, vi } from "vitest";
import { rawResponseObjectKey, saveRawResponse } from "./raw-responses";
import type { StoreProductRecord } from "./types";

const record: StoreProductRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  product_id: "22222222-2222-4222-8222-222222222222",
  store_id: "33333333-3333-4333-8333-333333333333",
  location_id: null,
  url: "https://example.test/product",
  external_name: "Producto",
  image_url: null,
  store_slug: "disco",
};

describe("respuestas crudas", () => {
  it("genera una clave estable por intento", () => {
    expect(rawResponseObjectKey("2026-09-09T07:00:00.000Z", "2026-09-09", record, "attempt-1"))
      .toBe("raw/2026-09-09/2026-09-09T07_00_00_000Z/disco/11111111-1111-4111-8111-111111111111/attempt-1.body.gz");
  });

  it("comprime y conserva metadata de la respuesta", async () => {
    const put = vi.fn(async () => undefined);
    const bucket = { put } as unknown as R2Bucket;
    const rawResponse = {
      url: record.url,
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<main>Producto $ 1299</main>",
    };

    const saved = await saveRawResponse(bucket, "run-1", "2026-09-09", record, rawResponse);

    expect(saved).toMatchObject({
      objectKey: expect.stringMatching(/^raw\/2026-09-09\/run-1\/disco\/11111111-1111-4111-8111-111111111111\/.+\.body\.gz$/),
      responseSizeBytes: new TextEncoder().encode(rawResponse.body).byteLength,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(put).toHaveBeenCalledWith(
      saved.objectKey,
      expect.any(ReadableStream),
      expect.objectContaining({
        httpMetadata: { contentType: rawResponse.contentType, contentEncoding: "gzip" },
        customMetadata: expect.objectContaining({ status: "200", sourceUrl: record.url, sha256: saved.sha256 }),
      }),
    );
  });
});
