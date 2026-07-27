import { randomBytes, randomInt } from "node:crypto";

export function generateNumericCode(length = 6): string {
  if (!Number.isInteger(length) || length < 4) {
    throw new Error("Numeric code length must be an integer of at least 4 digits");
  }

  const lowerBound = 10 ** (length - 1);
  const upperBound = 10 ** length;
  return String(randomInt(lowerBound, upperBound));
}

export function generateOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Opaque token length must be an integer of at least 16 bytes");
  }

  return randomBytes(byteLength).toString("base64url");
}
