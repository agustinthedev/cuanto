import { describe, expect, it } from "vitest";
import { dateDaysBefore } from "./dateRange";

describe("dateDaysBefore", () => {
  it("returns the start of an inclusive seven-day range", () => {
    expect(dateDaysBefore("2026-08-27", 6)).toBe("2026-08-21");
  });

  it("handles month and year boundaries", () => {
    expect(dateDaysBefore("2026-01-02", 3)).toBe("2025-12-30");
  });
});
