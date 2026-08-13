import { Redis } from "ioredis";
import { redisConnectionOptions } from "../notifications/email-queue.js";

const KEY_PREFIX = "denylisted-token:";

/**
 * Answers gap 5 (logout). Access tokens are stateless JWTs with no
 * server-side session, so "logout" cannot invalidate the token itself —
 * instead we record its `jti` here until the token's own expiry and reject
 * any request that presents a denylisted `jti`, even if the JWT signature
 * is otherwise valid.
 *
 * Backed by the same Redis instance already used for the email queue, so
 * this adds no new infrastructure. Entries expire automatically at the
 * token's own `exp`, so the denylist never grows unbounded and never needs
 * a cleanup job.
 */
export class TokenDenylist {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisConnectionOptions(redisUrl));
  }

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1_000));
    await this.redis.set(KEY_PREFIX + jti, "1", "EX", ttlSeconds);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(KEY_PREFIX + jti)) === 1;
  }

  close(): Promise<"OK"> {
    return this.redis.quit();
  }
}
