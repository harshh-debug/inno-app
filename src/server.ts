import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createPrismaClient } from "./database/prisma.js";
import { createNotificationsModule } from "./modules/notifications/notifications.module.js";
import { createAuthenticationModule } from "./modules/authentication/authentication.module.js";
import { createUsersModule } from "./modules/users/users.module.js";
import { createRecruitmentCyclesModule } from "./modules/recruitment-cycles/recruitment-cycles.module.js";
import { createRegistrationsModule } from "./modules/registrations/registrations.module.js";
import { createAppProfileModule } from "./modules/app-profile/index.js";

const environment = loadEnvironment();
const prisma = createPrismaClient(environment);
const notificationsModule = createNotificationsModule(environment);
const usersModule = createUsersModule(prisma);
const authenticationModule = createAuthenticationModule(prisma, notificationsModule.notificationService, environment);
const recruitmentCyclesModule = createRecruitmentCyclesModule(prisma);
const registrationsModule = createRegistrationsModule(
  prisma,
  recruitmentCyclesModule,
  usersModule,
  notificationsModule.notificationService,
);
const appProfileModule = createAppProfileModule(prisma);

const app = createApp(
  prisma,
  authenticationModule,
  recruitmentCyclesModule,
  {
    formController: registrationsModule.formController,
    adminRegistrationController: registrationsModule.adminRegistrationController,
    publicRegistrationController: registrationsModule.publicRegistrationController,
  },
  { controller: appProfileModule.controller },
  { controller: usersModule.controller },
);

const server = app.listen(environment.PORT, () => {
  console.info(`Backend listening on port ${environment.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down`);
  server.close(async () => {
    await notificationsModule.emailQueue.close();
    await authenticationModule.denylist.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
