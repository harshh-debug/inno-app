import { createHmac, randomBytes, randomInt } from "node:crypto";

export function generateNumericCode(length: number): string {
  if (!Number.isInteger(length) || length < 4) {
    throw new Error("Numeric code length must be an integer of at least 4 digits");
  }

  const lowerBound = 10 ** (length - 1);
  const upperBound = 10 ** length;
  return String(randomInt(lowerBound, upperBound));
}

export function generateOpaqueToken(byteLength: number): string {
  if (!Number.isInteger(byteLength) || byteLength < 16) {
    throw new Error("Opaque token length must be an integer of at least 16 bytes");
  }

  return randomBytes(byteLength).toString("base64url");
}

/**
 * Short numeric codes need a keyed hash: a plain digest is cheap to brute force
 * if the database is leaked. Module 3 supplies the secret from environment.
 */
export function hashVerificationValue(value: string, secret: string): string {
  if (secret.length === 0) {
    throw new Error("Verification hash secret must not be empty");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}
