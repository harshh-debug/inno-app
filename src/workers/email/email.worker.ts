import { hostname } from "node:os";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { EmailWorkerEnvironment } from "../../config/environment.js";
import type { EmailPayload } from "../../modules/notifications/email-payload.js";
import { EmailJobRepository, parseEmailPayload, type ClaimedEmailJob } from "./email-job.repository.js";
import { SmtpClient } from "./smtp-client.js";

/**
 * A claimed job is only reclaimable once its lock is this old. It has to
 * comfortably exceed the slowest realistic SMTP send, or a still-running job
 * gets handed to a second worker and the recipient receives the mail twice.
 */
const VISIBILITY_TIMEOUT_MS = 5 * 60 * 1_000;

/** Reclaiming is crash recovery, not hot-path work; once every ~30s is plenty. */
const STALE_CHECK_EVERY_TICKS = 30;

/**
 * Stateless delivery worker.
 *
 * It polls `email_jobs` instead of subscribing to a broker. Polling rather than
 * LISTEN/NOTIFY is deliberate: a notification is fire-and-forget, so a job
 * enqueued while this process is restarting would simply never be delivered.
 * The table is the source of truth, and a missed tick costs latency, not mail.
 *
 * The worker still owns no product logic — it reads only `email_jobs` and
 * sends the payload the API already built (see AGENTS.md).
 */
export class EmailWorker {
  private readonly repository: EmailJobRepository;
  private readonly smtpClient: SmtpClient;
  private readonly workerId: string;

  private stopped = false;
  private loop: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(
    prisma: PrismaClient,
    private readonly environment: EmailWorkerEnvironment,
  ) {
    this.repository = new EmailJobRepository(prisma);
    this.smtpClient = new SmtpClient(environment);
    this.workerId = `${hostname()}:${process.pid}`.slice(0, 100);
  }

  start(): void {
    this.stopped = false;
    this.loop = this.run();
  }

  /** Finishes the in-flight send, hands back anything unstarted, then returns. */
  async stop(): Promise<void> {
    this.stopped = true;
    this.wake?.();
    await this.loop;
    this.loop = null;
  }

  private async run(): Promise<void> {
    let ticks = 0;

    while (!this.stopped) {
      try {
        if (ticks % STALE_CHECK_EVERY_TICKS === 0) {
          const reclaimed = await this.repository.reclaimStale(VISIBILITY_TIMEOUT_MS);
          if (reclaimed > 0) {
            console.warn(`Email worker reclaimed ${reclaimed} stale job(s) from a stopped worker`);
          }
        }
        ticks += 1;

        // A full batch means more is probably waiting, so skip the idle wait
        // and drain instead of trickling one batch per poll interval.
        if (await this.tick() === this.environment.EMAIL_BATCH_SIZE) {
          continue;
        }
      } catch (error) {
        // Usually Postgres being briefly unreachable. Back off and retry
        // rather than tearing the process down.
        console.error("Email worker poll failed", { error: describe(error) });
      }

      await this.sleep(this.environment.EMAIL_POLL_INTERVAL_MS);
    }
  }

  private async tick(): Promise<number> {
    const jobs = await this.repository.claim(this.environment.EMAIL_BATCH_SIZE, this.workerId);

    for (let index = 0; index < jobs.length; index += 1) {
      if (this.stopped) {
        // Claimed during shutdown and never attempted — return them now so the
        // next worker picks them up immediately instead of waiting out the
        // visibility timeout.
        await Promise.all(jobs.slice(index).map((job) => this.repository.release(job.id)));
        break;
      }

      await this.deliver(jobs[index]!);
    }

    return jobs.length;
  }

  private async deliver(job: ClaimedEmailJob): Promise<void> {
    let payload: EmailPayload;
    try {
      payload = parseEmailPayload(job.payload);
    } catch (error) {
      // Retrying cannot repair a malformed row, so give up immediately.
      await this.repository.fail(job, describe(error), { permanent: true });
      this.logFailure(job, error, true);
      return;
    }

    try {
      await this.smtpClient.send(payload);
    } catch (error) {
      const gaveUp = await this.repository.fail(job, describe(error));
      this.logFailure(job, error, gaveUp);
      return;
    }

    await this.repository.complete(job.id);
  }

  private logFailure(job: ClaimedEmailJob, error: unknown, gaveUp: boolean): void {
    console.error("Email delivery job failed", {
      jobId: job.id,
      type: job.type,
      attemptsMade: job.attempts,
      gaveUp,
      error: describe(error),
    });
  }

  /** Interruptible so shutdown does not have to wait out a full poll interval. */
  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, durationMs);

      this.wake = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createEmailWorker(
  prisma: PrismaClient,
  environment: EmailWorkerEnvironment,
): EmailWorker {
  return new EmailWorker(prisma, environment);
}
