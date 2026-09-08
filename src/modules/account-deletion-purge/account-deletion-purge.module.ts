import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { TokenDenylist } from "../authentication/token-denylist.js";
import { AccountDeletionPurgeRepository } from "./account-deletion-purge.repository.js";
import { AccountDeletionPurgeScheduler } from "./account-deletion-purge.scheduler.js";
import { AccountDeletionPurgeService } from "./account-deletion-purge.service.js";

export function createAccountDeletionPurgeModule(prisma: PrismaClient, denylist: TokenDenylist) {
  const repository = new AccountDeletionPurgeRepository(prisma);
  const service = new AccountDeletionPurgeService(repository, denylist);
  const scheduler = new AccountDeletionPurgeScheduler(prisma, service);
  scheduler.start();
  return { repository, service, scheduler };
}
