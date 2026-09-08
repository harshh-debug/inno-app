import { loadEmailWorkerEnvironment } from "../../config/environment.js";
import { createPrismaClient } from "../../database/prisma.js";
import { createEmailWorker } from "./email.worker.js";

const environment = loadEmailWorkerEnvironment();
const prisma = createPrismaClient(environment);
const worker = createEmailWorker(prisma, environment);

worker.start();
console.info("Email worker started");

async function shutdown(signal: string): Promise<void> {
  console.info(`Email worker received ${signal}; shutting down`);
  await worker.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
