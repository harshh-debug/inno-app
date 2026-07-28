import { Worker } from "bullmq";
import type { EmailWorkerEnvironment } from "../../config/environment.js";
import { EMAIL_QUEUE_NAME, redisConnectionOptions } from "../../modules/notifications/email-queue.js";
import type { QueuedEmailJob } from "../../modules/notifications/email-payload.js";
import { SmtpClient } from "./smtp-client.js";

/**
 * Stateless delivery worker. It deliberately has no Prisma/database imports
 * and receives only the final payload to send.
 */
export function createEmailWorker(environment: EmailWorkerEnvironment): Worker<QueuedEmailJob> {
  const smtpClient = new SmtpClient(environment);
  const worker = new Worker<QueuedEmailJob>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await smtpClient.send(job.data.payload);
    },
    { connection: redisConnectionOptions(environment.REDIS_URL) },
  );

  worker.on("failed", (job, error) => {
    console.error("Email delivery job failed", {
      jobId: job?.id,
      type: job?.data.type,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  });

  return worker;
}
