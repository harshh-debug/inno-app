import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { PlatformRole } from "../../../generated/prisma/client.js";

export const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches §7 of the app contract

export interface AccessTokenClaims {
  userId: string;
  role: PlatformRole;
}

/**
 * Claims returned on verification. `jti` and `expiresAt` are only needed for
 * logout (see TokenDenylist) — nothing else in the app reads them, and the
 * app must keep treating the token itself as opaque (§2 of the contract).
 */
export interface VerifiedAccessTokenClaims extends AccessTokenClaims {
  jti: string;
  expiresAt: Date;
}

export class AccessTokenService {
  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async create(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ role: claims.role })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.secret);
  }

  async verify(token: string): Promise<VerifiedAccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.exp !== "number"
    ) {
      throw new Error("Access token claims are invalid");
    }
    return {
      userId: payload.sub,
      role: payload.role as PlatformRole,
      jti: payload.jti,
      expiresAt: new Date(payload.exp * 1_000),
    };
  }
}
