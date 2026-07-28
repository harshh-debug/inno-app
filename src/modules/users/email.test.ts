import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email.js";

describe("normalizeEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  Student@Example.com  ")).toBe("student@example.com");
  });
});
