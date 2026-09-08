import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { EmailPayload } from "../../modules/notifications/email-payload.js";

export interface ClaimedEmailJob {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

interface ClaimedRow {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
}

/**
 * The only database access the email worker is permitted (see AGENTS.md).
 * Every statement here is scoped to `email_jobs`; the worker never reads a
 * business table and never decides whether an email should be sent.
 */
export class EmailJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Atomically take up to `limit` due jobs.
   *
   * SKIP LOCKED is what makes this safe to run from several workers at once:
   * rows another transaction has already locked are passed over instead of
   * blocking, so no two workers ever claim the same job and no worker waits.
   *
   * The claim is a single statement on purpose — nothing holds a transaction
   * open across the SMTP call, which could otherwise pin a connection for the
   * whole network timeout.
   *
   * `attempts` is incremented here rather than on failure, so a worker that is
   * killed mid-send still consumes an attempt and a job that reliably crashes
   * the worker cannot be retried forever.
   */
  async claim(limit: number, workerId: string): Promise<ClaimedEmailJob[]> {
    const rows = await this.prisma.$queryRaw<ClaimedRow[]>`
      UPDATE email_jobs
      SET status = 'PROCESSING',
          locked_at = now(),
          locked_by = ${workerId},
          attempts = attempts + 1,
          updated_at = now()
      WHERE id IN (
        SELECT id
        FROM email_jobs
        WHERE status = 'PENDING' AND run_at <= now()
        ORDER BY run_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id, type, payload, attempts, max_attempts
    `;

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
    }));
  }

  /**
   * Delivered jobs are deleted, not marked sent: BACKEND_ARCHITECTURE.md
   * forbids retaining email delivery state, and this drops the plaintext OTP
   * carried in `payload` as soon as it is no longer needed.
   */
  async complete(id: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM email_jobs WHERE id = ${id}`;
  }

  /**
   * Reschedule a failed job, or give up on it once attempts are exhausted.
   * `permanent` short-circuits the retries for errors that cannot succeed on a
   * second attempt, such as a payload that fails validation.
   */
  async fail(
    job: ClaimedEmailJob,
    error: string,
    options: { permanent?: boolean } = {},
  ): Promise<boolean> {
    const exhausted = options.permanent === true || job.attempts >= job.maxAttempts;

    if (exhausted) {
      await this.prisma.$executeRaw`
        UPDATE email_jobs
        SET status = 'FAILED', last_error = ${error},
            locked_at = NULL, locked_by = NULL, updated_at = now()
        WHERE id = ${job.id}
      `;
      return true;
    }

    // Matches the exponential/1s base the BullMQ configuration used, so retry
    // spacing is unchanged by the move off Redis: 1s, 2s, 4s, 8s.
    const backoffMs = 1_000 * 2 ** (job.attempts - 1);
    await this.prisma.$executeRaw`
      UPDATE email_jobs
      SET status = 'PENDING',
          run_at = now() + (${backoffMs}::double precision) * INTERVAL '1 millisecond',
          last_error = ${error},
          locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE id = ${job.id}
    `;
    return false;
  }

  /**
   * Hand back a job claimed during shutdown that was never actually attempted.
   * The attempt taken at claim time is given back, since no send happened.
   */
  async release(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE email_jobs
      SET status = 'PENDING', run_at = now(),
          attempts = GREATEST(attempts - 1, 0),
          locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE id = ${id} AND status = 'PROCESSING'
    `;
  }

  /**
   * Recover jobs whose worker died after claiming them. Without this a crash
   * strands rows in PROCESSING forever — there is no broker holding a
   * visibility timeout on our behalf any more, so the timeout lives here.
   */
  async reclaimStale(visibilityTimeoutMs: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE email_jobs
      SET status = CASE
            WHEN attempts >= max_attempts THEN 'FAILED'::"EmailJobStatus"
            ELSE 'PENDING'::"EmailJobStatus"
          END,
          run_at = now(),
          last_error = COALESCE(last_error, 'Worker stopped before the send completed'),
          locked_at = NULL, locked_by = NULL, updated_at = now()
      WHERE status = 'PROCESSING'
        AND locked_at < now() - (${visibilityTimeoutMs}::double precision) * INTERVAL '1 millisecond'
    `;
  }
}

/** Guards against a malformed row taking the whole loop down. */
export function parseEmailPayload(payload: unknown): EmailPayload {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Email job payload is not an object");
  }

  const candidate = payload as Record<string, unknown>;
  for (const key of ["to", "subject", "text", "html"] as const) {
    if (typeof candidate[key] !== "string") {
      throw new Error(`Email job payload is missing a string "${key}"`);
    }
  }

  return candidate as unknown as EmailPayload;
}
