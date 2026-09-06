import { describe, expect, it } from "vitest";
import { isValidCaptureEmail, normalizeCaptureEmail } from "./emailCapture";

describe("email capture validation", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeCaptureEmail("  Persona@Ejemplo.COM ")).toBe("persona@ejemplo.com");
  });

  it("accepts a normal email and rejects malformed values", () => {
    expect(isValidCaptureEmail("persona@ejemplo.com")).toBe(true);
    expect(isValidCaptureEmail("persona@ejemplo")).toBe(false);
    expect(isValidCaptureEmail("persona ejemplo@ejemplo.com")).toBe(false);
  });
});
