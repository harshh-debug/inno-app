import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createPrismaClient } from "./database/prisma.js";

const environment = loadEnvironment();
const prisma = createPrismaClient(environment);
const app = createApp(prisma);

const server = app.listen(environment.PORT, () => {
  console.info(`Backend listening on port ${environment.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
