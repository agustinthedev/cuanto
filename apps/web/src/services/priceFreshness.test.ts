import { describe, expect, it } from "vitest";
import { isLatestPriceFresh, uruguayDate } from "./priceFreshness";

describe("isLatestPriceFresh", () => {
  it("accepts today's and yesterday's observations", () => {
    expect(isLatestPriceFresh("2026-09-10", "2026-09-10")).toBe(true);
    expect(isLatestPriceFresh("2026-09-09", "2026-09-10")).toBe(true);
  });

  it("rejects observations older than yesterday", () => {
    expect(isLatestPriceFresh("2026-09-08", "2026-09-10")).toBe(false);
  });

  it("rejects malformed and future dates", () => {
    expect(isLatestPriceFresh("2026-02-30", "2026-09-10")).toBe(false);
    expect(isLatestPriceFresh("2026-09-11", "2026-09-10")).toBe(false);
  });
});

describe("uruguayDate", () => {
  it("uses Uruguay's calendar date near midnight", () => {
    expect(uruguayDate(new Date("2026-09-10T02:30:00.000Z"))).toBe("2026-09-09");
    expect(uruguayDate(new Date("2026-09-10T03:30:00.000Z"))).toBe("2026-09-10");
  });
});
