import { SignJWT, jwtVerify } from "jose";
import type { PlatformRole } from "../../../generated/prisma/client.js";

export interface AccessTokenClaims {
  userId: string;
  role: PlatformRole;
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
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.secret);
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new Error("Access token claims are invalid");
    }
    return { userId: payload.sub, role: payload.role as PlatformRole };
  }
}
