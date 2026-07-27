import { describe, expect, it } from "vitest";
import { hashPassword, hashVerificationValue, verifyPassword, normalizeEmail } from "./hash.js";

describe("hash helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("s3cret-password");

    await expect(verifyPassword("s3cret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("hashes verification values deterministically", () => {
    expect(hashVerificationValue("123456")).toBe(hashVerificationValue("123456"));
  });
});
describe("normalizeEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  Student@Example.com  ")).toBe("student@example.com");
  });
});

