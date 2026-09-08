import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { PublicAccountDeletionController } from "./public-account-deletion.controller.js";
import { PublicAccountDeletionRepository } from "./public-account-deletion.repository.js";
import { PublicAccountDeletionService } from "./public-account-deletion.service.js";

export function createPublicAccountDeletionModule(
  prisma: PrismaClient,
  notifications: NotificationService,
  verificationHashSecret: string,
  appUrl: string,
) {
  const repository = new PublicAccountDeletionRepository(prisma);
  const service = new PublicAccountDeletionService(repository, notifications, verificationHashSecret, appUrl);
  const controller = new PublicAccountDeletionController(service);
  return { repository, service, controller };
}
