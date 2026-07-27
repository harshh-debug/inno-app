import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_FORMAT_PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return [PASSWORD_FORMAT_PREFIX, salt, derivedKey.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [format, salt, encodedDerivedKey] = storedHash.split("$");

  if (format !== PASSWORD_FORMAT_PREFIX || salt === undefined || encodedDerivedKey === undefined) {
    return false;
  }

  const expectedDerivedKey = Buffer.from(encodedDerivedKey, "base64url");
  const actualDerivedKey = (await scrypt(password, salt, expectedDerivedKey.length)) as Buffer;

  return expectedDerivedKey.length === actualDerivedKey.length && timingSafeEqual(expectedDerivedKey, actualDerivedKey);
}

export function hashVerificationValue(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
