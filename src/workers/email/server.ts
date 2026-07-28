import { loadEmailWorkerEnvironment } from "../../config/environment.js";
import { createEmailWorker } from "./email.worker.js";

const environment = loadEmailWorkerEnvironment();
const worker = createEmailWorker(environment);

console.info("Email worker started");

async function shutdown(signal: string): Promise<void> {
  console.info(`Email worker received ${signal}; shutting down`);
  await worker.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
