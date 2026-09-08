import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "../app-profile/account-deletion.constants.js";
import type { TokenDenylist } from "../authentication/token-denylist.js";
import type { AccountDeletionPurgeRepository } from "./account-deletion-purge.repository.js";

export interface PurgeRunResult {
  anonymizedAccounts: number;
  sweptTokens: number;
  sweptEmailJobs: number;
}

// Failed email jobs are terminal, so this is retention, not correctness.
const FAILED_EMAIL_JOB_RETENTION_DAYS = 7;

export class AccountDeletionPurgeService {
  constructor(
    private readonly repository: AccountDeletionPurgeRepository,
    private readonly denylist: TokenDenylist,
  ) {}

  /**
   * Everything the scheduled purge does. The revoked-token and failed-email-job
   * sweeps ride along here because Postgres has no per-row TTL and this is the
   * only recurring job in the API process — it is housekeeping, not
   * correctness, so it is safe for it to run late or be skipped (see
   * TokenDenylist).
   */
  async run(now: Date = new Date()): Promise<PurgeRunResult> {
    return {
      anonymizedAccounts: await this.purgeDueAccounts(now),
      sweptTokens: await this.denylist.deleteExpired(now),
      sweptEmailJobs: await this.sweepFailedEmailJobs(now),
    };
  }

  async sweepFailedEmailJobs(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - FAILED_EMAIL_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
    const { count } = await this.repository.deleteFailedEmailJobs(cutoff);
    return count;
  }

  async purgeDueAccounts(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1_000);
    const due = await this.repository.findDueForPurge(cutoff);
    for (const { id } of due) {
      await this.repository.anonymize(id, now);
    }
    return due.length;
  }
}
