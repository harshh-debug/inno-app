import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AccountDeletionPurgeService } from "./account-deletion-purge.service.js";

// Grace period is 14 days, so checking every 6 hours is frequent enough that
// no account sits anonymizable for long, without running the scan constantly.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1_000;

// Long enough that boot is not competing with request traffic, short enough
// that a local run is easy to observe.
const INITIAL_DELAY_MS = 10 * 1_000;

// Arbitrary but fixed: any key works, provided every replica uses the same one.
const PURGE_ADVISORY_LOCK_KEY = 4_820_7731;

/**
 * Replaces the BullMQ repeatable job. Running once shortly after boot and then
 * every 6 hours means a frequently-restarted API still purges, where a bare
 * interval could be reset forever by deploys. Re-running early is harmless:
 * the purge is idempotent housekeeping that is safe to run late, often, or not
 * at all (see AccountDeletionPurgeService.run).
 */
export class AccountDeletionPurgeScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly service: AccountDeletionPurgeService,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(INITIAL_DELAY_MS);
  }

  /** Cancels the next run and waits for one already in progress to finish. */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.running;
  }

  private schedule(delayMs: number): void {
    this.timer = setTimeout(() => void this.tick(), delayMs);
    // Never hold the process open just for housekeeping.
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    this.timer = null;

    this.running = this.runOnce();
    try {
      await this.running;
    } finally {
      this.running = null;
    }

    if (!this.stopped) {
      this.schedule(PURGE_INTERVAL_MS);
    }
  }

  /**
   * A session-level advisory lock keeps a second API replica from running the
   * same scan concurrently. try_ is deliberate — if another replica holds it,
   * this one skips rather than queues, because the work is already being done.
   */
  private async runOnce(): Promise<void> {
    let acquired = false;
    try {
      const [row] = await this.prisma.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_lock(${PURGE_ADVISORY_LOCK_KEY}) AS locked
      `;
      acquired = row?.locked === true;
      if (!acquired) {
        return;
      }

      const { anonymizedAccounts, sweptTokens, sweptEmailJobs } = await this.service.run();
      if (anonymizedAccounts > 0 || sweptTokens > 0 || sweptEmailJobs > 0) {
        console.info(
          `Account deletion purge: anonymized ${anonymizedAccounts} account(s), ` +
            `swept ${sweptTokens} expired token(s) and ${sweptEmailJobs} failed email job(s)`,
        );
      }
    } catch (error) {
      console.error("Account deletion purge failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (acquired) {
        await this.prisma
          .$queryRaw`SELECT pg_advisory_unlock(${PURGE_ADVISORY_LOCK_KEY})`
          .catch(() => undefined);
      }
    }
  }
}
