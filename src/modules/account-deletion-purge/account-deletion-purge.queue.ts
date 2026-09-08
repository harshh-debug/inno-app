import { Queue } from "bullmq";
import { redisConnectionOptions } from "../notifications/email-queue.js";

export const ACCOUNT_DELETION_PURGE_QUEUE_NAME = "account-deletion-purge";
export const ACCOUNT_DELETION_PURGE_JOB_NAME = "purge-due-accounts";

// Grace period is 14 days, so checking every 6 hours is frequent enough that
// no account sits anonymizable for long, without running the scan constantly.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1_000;

export function createAccountDeletionPurgeQueue(redisUrl: string): Queue {
  return new Queue(ACCOUNT_DELETION_PURGE_QUEUE_NAME, { connection: redisConnectionOptions(redisUrl) });
}

// BullMQ repeatable jobs are keyed by name+pattern, so calling this on every
// server boot is idempotent — it does not create duplicate schedules.
export async function scheduleAccountDeletionPurge(queue: Queue): Promise<void> {
  await queue.add(
    ACCOUNT_DELETION_PURGE_JOB_NAME,
    {},
    { repeat: { every: PURGE_INTERVAL_MS }, removeOnComplete: 100, removeOnFail: 100 },
  );
}
