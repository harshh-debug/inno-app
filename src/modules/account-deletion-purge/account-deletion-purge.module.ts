import type { PrismaClient } from "../../../generated/prisma/client.js";
import { AccountDeletionPurgeRepository } from "./account-deletion-purge.repository.js";
import { createAccountDeletionPurgeQueue, scheduleAccountDeletionPurge } from "./account-deletion-purge.queue.js";
import { AccountDeletionPurgeService } from "./account-deletion-purge.service.js";
import { createAccountDeletionPurgeWorker } from "./account-deletion-purge.worker.js";

export async function createAccountDeletionPurgeModule(prisma: PrismaClient, redisUrl: string) {
  const repository = new AccountDeletionPurgeRepository(prisma);
  const service = new AccountDeletionPurgeService(repository);
  const queue = createAccountDeletionPurgeQueue(redisUrl);
  const worker = createAccountDeletionPurgeWorker(redisUrl, service);
  await scheduleAccountDeletionPurge(queue);
  return { repository, service, queue, worker };
}
