import type { Environment } from "../../config/environment.js";
import { EmailQueue } from "./email-queue.js";
import { NotificationService } from "./notification.service.js";

/** Composition root for backend email payload preparation and queueing. */
export function createNotificationsModule(environment: Pick<Environment, "REDIS_URL" | "APP_URL">) {
  const emailQueue = new EmailQueue(environment.REDIS_URL);
  const notificationService = new NotificationService(emailQueue, environment.APP_URL);

  return { emailQueue, notificationService };
}
