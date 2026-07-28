import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createPrismaClient } from "./database/prisma.js";
import { createNotificationsModule } from "./modules/notifications/notifications.module.js";
import { createAuthenticationModule } from "./modules/authentication/authentication.module.js";

const environment = loadEnvironment();
const prisma = createPrismaClient(environment);
const notificationsModule = createNotificationsModule(environment);
const authenticationModule = createAuthenticationModule(prisma, notificationsModule.notificationService, environment);
const app = createApp(prisma, authenticationModule);

const server = app.listen(environment.PORT, () => {
  console.info(`Backend listening on port ${environment.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down`);
  server.close(async () => {
    await notificationsModule.emailQueue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
