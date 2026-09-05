import { describe, expect, it } from "vitest";
import { buildHomepageSearchTrackingInput } from "./homeSearchTracking";
import type { Product } from "../services/types";

describe("homepage search tracking", () => {
  it("builds an event from the automatically loaded result set", () => {
    expect(buildHomepageSearchTrackingInput(" leche ", {
      total: 25,
      products: [{ id: "product-1" } as Product],
    })).toEqual({
      query: " leche ",
      resultCount: 25,
      resultProductIds: ["product-1"],
      path: "/",
    });
  });
});
