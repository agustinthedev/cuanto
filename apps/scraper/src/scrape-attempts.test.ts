import { describe, expect, it } from "vitest";
import { buildScrapeAttempt } from "./scrape-attempts";
import { ScraperError } from "./stores/base";
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

describe("intentos de scraping", () => {
  it("serializa provenance y referencia del body guardado", () => {
    expect(buildScrapeAttempt({
      runId: "run-1",
      date: "2026-09-09",
      record,
      attemptedAt: "2026-09-09T07:00:00.000Z",
      status: "success",
      result: {
        price: 1299,
        source: "html",
        evidence: {
          selectedPath: "meta[property=product:price:amount]",
          candidates: [{ path: "meta[property=product:price:amount]", value: 1299 }],
        },
        rawResponse: {
          url: record.url,
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: "<main>Producto</main>",
        },
      },
      rawReference: {
        objectKey: "raw/run-1/body.gz",
        sha256: "a".repeat(64),
        responseSizeBytes: 21,
      },
    })).toEqual({
      run_id: "run-1",
      product_id: record.product_id,
      store_product_id: record.id,
      store_id: record.store_id,
      date: "2026-09-09",
      attempted_at: "2026-09-09T07:00:00.000Z",
      status: "success",
      source_type: "html",
      source_url: record.url,
      response_url: record.url,
      http_status: 200,
      content_type: "text/html; charset=utf-8",
      response_size_bytes: 21,
      response_sha256: "a".repeat(64),
      raw_object_key: "raw/run-1/body.gz",
      price: 1299,
      selected_path: "meta[property=product:price:amount]",
      candidates: [{ path: "meta[property=product:price:amount]", value: 1299 }],
      error: null,
    });
  });

  it("conserva el error y la respuesta aun cuando no haya precio", () => {
    expect(buildScrapeAttempt({
      runId: "run-1",
      date: "2026-09-09",
      record,
      attemptedAt: "2026-09-09T07:00:00.000Z",
      status: "failed",
      rawResponse: {
        url: record.url,
        status: 200,
        contentType: "text/html",
        body: "<main>Producto no encontrado</main>",
      },
      error: new Error("No se encontró el producto"),
    })).toMatchObject({
      status: "failed",
      source_type: null,
      response_url: record.url,
      http_status: 200,
      response_size_bytes: new TextEncoder().encode("<main>Producto no encontrado</main>").byteLength,
      price: null,
      candidates: [],
      error: "No se encontró el producto",
    });
  });

  it("conserva el tipo de fuente conocido en un error de parseo", () => {
    const rawResponse = {
      url: record.url,
      status: 200,
      contentType: "text/html",
      body: "Producto no encontrado",
    };

    expect(buildScrapeAttempt({
      runId: "run-1",
      date: "2026-09-09",
      record,
      attemptedAt: "2026-09-09T07:00:00.000Z",
      status: "failed",
      rawResponse,
      error: new ScraperError("No se encontró un precio", rawResponse, "html"),
    })).toMatchObject({
      status: "failed",
      source_type: "html",
    });
  });
});
