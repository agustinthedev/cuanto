import { describe, expect, it } from "vitest";
import { clearPendingHomepageSearch, type PendingHomepageSearch } from "./homeSearchTracking";

describe("homepage search tracking state", () => {
  it("clears a pending search when the search input is cleared", () => {
    const pendingSearchRef: { current: PendingHomepageSearch | null } = {
      current: { query: "leche", categoryId: "" },
    };

    clearPendingHomepageSearch(pendingSearchRef);

    expect(pendingSearchRef.current).toBeNull();
  });
});
