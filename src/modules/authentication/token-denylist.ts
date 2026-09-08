import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { VerifiedAccessTokenClaims } from "./token.js";

/**
 * Answers gap 5 (logout). Access tokens are stateless JWTs with no
 * server-side session, so "logout" cannot invalidate the token itself —
 * instead we record its `jti` here until the token's own expiry and reject
 * any request that presents a denylisted `jti`, even if the JWT signature
 * is otherwise valid.
 *
 * Backed by the `revoked_tokens` table, so the denylist survives restarts
 * and needs no infrastructure beyond the database the app already has.
 * Postgres has no per-row TTL, so `deleteExpired` drops rows past their own
 * `exp`; the account-deletion purge job calls it every 6 hours. That sweep
 * is housekeeping only — a stale row can never match a live token, because
 * `jti` is unique per issued token and `AccessTokenService.verify` rejects
 * an expired JWT before the denylist is consulted.
 *
 * This owns every query against `revoked_tokens`; nothing else touches it.
 */
export class TokenDenylist {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert rather than create: logging out twice with the same token is a
   * no-op, not a unique-constraint failure.
   */
  async revoke(claims: VerifiedAccessTokenClaims): Promise<void> {
    await this.prisma.revokedToken.upsert({
      where: { jti: claims.jti },
      create: { jti: claims.jti, userId: claims.userId, expiresAt: claims.expiresAt },
      update: {},
    });
  }

  async isRevoked(jti: string): Promise<boolean> {
    const revoked = await this.prisma.revokedToken.findUnique({
      where: { jti },
      select: { jti: true },
    });
    return revoked !== null;
  }

  /** Returns how many rows were dropped, for the purge job's log line. */
  async deleteExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return count;
  }
}
