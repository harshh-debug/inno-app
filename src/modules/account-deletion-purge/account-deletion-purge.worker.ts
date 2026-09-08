import { Worker } from "bullmq";
import { redisConnectionOptions } from "../notifications/email-queue.js";
import { ACCOUNT_DELETION_PURGE_QUEUE_NAME } from "./account-deletion-purge.queue.js";
import type { AccountDeletionPurgeService } from "./account-deletion-purge.service.js";

/**
 * Unlike the email worker, this runs in the main API process, not the
 * separate worker process — it needs Prisma, which the email worker is
 * explicitly forbidden from touching (see AGENTS.md).
 */
export function createAccountDeletionPurgeWorker(
  redisUrl: string,
  service: AccountDeletionPurgeService,
): Worker {
  const worker = new Worker(
    ACCOUNT_DELETION_PURGE_QUEUE_NAME,
    async () => {
      const { anonymizedAccounts, sweptTokens } = await service.run();
      if (anonymizedAccounts > 0 || sweptTokens > 0) {
        console.info(
          `Account deletion purge: anonymized ${anonymizedAccounts} account(s), swept ${sweptTokens} expired token(s)`,
        );
      }
    },
    { connection: redisConnectionOptions(redisUrl) },
  );

  worker.on("failed", (job, error) => {
    console.error("Account deletion purge job failed", { jobId: job?.id, error: error.message });
  });

  return worker;
}
