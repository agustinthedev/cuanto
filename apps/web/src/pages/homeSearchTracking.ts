import type { TrackSearchInput } from "../services/analytics";
import type { HomepageProductResult } from "../services/data";

export function buildHomepageSearchTrackingInput(query: string, result: HomepageProductResult): TrackSearchInput {
  return {
    query,
    resultCount: result.total,
    resultProductIds: result.products.map((product) => product.id),
    path: "/",
  };
}
