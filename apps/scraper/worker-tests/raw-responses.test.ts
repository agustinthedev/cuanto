import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { saveRawResponse } from "../src/raw-responses";

describe("R2 raw response persistence", () => {
  it("uploads and reads back a compressed response through the Workers R2 binding", async () => {
    const rawResponse = {
      url: "https://store.example/products/test-product",
      status: 200,
      contentType: "text/html",
      body: "<html><body>smoke-test</body></html>",
    };

    const reference = await saveRawResponse(
      env.SCRAPE_RESPONSES_BUCKET,
      "r2-smoke-test",
      "2026-09-10",
      {
        id: "product-id",
        product_id: "product-id",
        store_id: "store-id",
        location_id: null,
        url: rawResponse.url,
        external_name: "Smoke test product",
        image_url: null,
        store_slug: "store",
      },
      "success",
      rawResponse,
    );

    try {
      const object = await env.SCRAPE_RESPONSES_BUCKET.get(reference.objectKey);

      expect(object).not.toBeNull();
      if (!object) {
        throw new Error("The R2 object was not found after upload");
      }

      const body = await new Response(
        object.body.pipeThrough(new DecompressionStream("gzip")),
      ).text();

      expect(body).toBe(rawResponse.body);
      expect(object.httpMetadata?.contentEncoding).toBe("gzip");
      expect(object.customMetadata?.sha256).toBe(reference.sha256);
    } finally {
      await env.SCRAPE_RESPONSES_BUCKET.delete(reference.objectKey);
    }
  });
});
