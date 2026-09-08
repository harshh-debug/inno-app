import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { EmailJobType, EmailPayload } from "./email-payload.js";

/**
 * Backend-facing queue. It accepts only complete, ready-to-send payloads.
 *
 * Enqueueing is a plain INSERT, so it participates in whatever transaction the
 * caller is already in and is durable the moment the caller's commit lands —
 * there is no separate broker that can be unreachable while Postgres is up.
 */
export class EmailQueue {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(type: EmailJobType, payload: EmailPayload): Promise<void> {
    // Spread, not `payload` directly: Prisma's InputJsonValue requires a
    // structural object type, and an interface has no implicit index signature.
    await this.prisma.emailJob.create({ data: { type, payload: { ...payload } } });
  }
}
