import { describe, expect, it } from "vitest";
import { generateNumericCode, generateOpaqueToken, hashVerificationValue } from "./verification-secret.js";

describe("verification secrets", () => {
  it("creates a numeric code with the requested length", () => {
    expect(generateNumericCode(6)).toMatch(/^\d{6}$/);
  });

  it("creates an opaque URL-safe token", () => {
    expect(generateOpaqueToken(32)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("uses the secret when hashing a verification value", () => {
    expect(hashVerificationValue("123456", "secret-a")).toBe(hashVerificationValue("123456", "secret-a"));
    expect(hashVerificationValue("123456", "secret-a")).not.toBe(hashVerificationValue("123456", "secret-b"));
  });
});
