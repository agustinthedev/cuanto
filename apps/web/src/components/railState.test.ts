import { describe, expect, it } from "vitest";
import { getRailScrollState } from "./railState";

describe("getRailScrollState", () => {
  it("does not enable arrows when the rail fits its viewport", () => {
    expect(getRailScrollState(0, 900, 900)).toEqual({ canScrollLeft: false, canScrollRight: false });
  });

  it("enables the right arrow when the loaded content is wider", () => {
    expect(getRailScrollState(0, 900, 1800)).toEqual({ canScrollLeft: false, canScrollRight: true });
  });

  it("enables the left arrow after the rail moves forward", () => {
    expect(getRailScrollState(420, 900, 1800)).toEqual({ canScrollLeft: true, canScrollRight: true });
  });
});
