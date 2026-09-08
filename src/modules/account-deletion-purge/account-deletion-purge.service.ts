import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "../app-profile/account-deletion.constants.js";
import type { AccountDeletionPurgeRepository } from "./account-deletion-purge.repository.js";

export class AccountDeletionPurgeService {
  constructor(private readonly repository: AccountDeletionPurgeRepository) {}

  async purgeDueAccounts(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1_000);
    const due = await this.repository.findDueForPurge(cutoff);
    for (const { id } of due) {
      await this.repository.anonymize(id, now);
    }
    return due.length;
  }
}
