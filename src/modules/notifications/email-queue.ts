import { Queue } from "bullmq";
import type { RedisOptions } from "ioredis";
import type { EmailJobType, QueuedEmailJob } from "./email-payload.js";

export const EMAIL_QUEUE_NAME = "email";

export const emailJobOptions = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 1_000,
  },
  removeOnComplete: 1_000,
  removeOnFail: 1_000,
};

export function redisConnectionOptions(redisUrl: string): RedisOptions {
  const parsedUrl = new URL(redisUrl);
  if (parsedUrl.protocol !== "redis:" && parsedUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol");
  }

  const database = parsedUrl.pathname === "" || parsedUrl.pathname === "/" ? undefined : Number(parsedUrl.pathname.slice(1));
  if (database !== undefined && (!Number.isInteger(database) || database < 0)) {
    throw new Error("REDIS_URL contains an invalid database number");
  }

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port === "" ? 6379 : Number(parsedUrl.port),
    username: parsedUrl.username === "" ? undefined : decodeURIComponent(parsedUrl.username),
    password: parsedUrl.password === "" ? undefined : decodeURIComponent(parsedUrl.password),
    db: database,
    tls: parsedUrl.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/** Backend-facing queue. It accepts only complete, ready-to-send payloads. */
export class EmailQueue {
  private readonly queue: Queue<QueuedEmailJob>;

  constructor(redisUrl: string) {
    this.queue = new Queue<QueuedEmailJob>(EMAIL_QUEUE_NAME, {
      connection: redisConnectionOptions(redisUrl),
      defaultJobOptions: emailJobOptions,
    });
  }

  async enqueue(type: EmailJobType, payload: QueuedEmailJob["payload"]): Promise<void> {
    await this.queue.add(type, { type, payload });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
