import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Environment } from "../../config/environment.js";
import { EmailQueue } from "./email-queue.js";
import { NotificationService } from "./notification.service.js";

/** Composition root for backend email payload preparation and queueing. */
export function createNotificationsModule(
  prisma: PrismaClient,
  environment: Pick<Environment, "APP_URL">,
) {
  const emailQueue = new EmailQueue(prisma);
  const notificationService = new NotificationService(emailQueue, environment.APP_URL);

  return { emailQueue, notificationService };
}
