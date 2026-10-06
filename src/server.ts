import { createApp } from "./app.js";
import { loadEmailWorkerEnvironment, loadEnvironment } from "./config/environment.js";
import { createPrismaClient } from "./database/prisma.js";
import { createEmailWorker } from "./workers/email/email.worker.js";
import { createNotificationsModule } from "./modules/notifications/notifications.module.js";
import { createAuthenticationModule } from "./modules/authentication/authentication.module.js";
import { createUsersModule } from "./modules/users/users.module.js";
import { createRecruitmentCyclesModule } from "./modules/recruitment-cycles/recruitment-cycles.module.js";
import { createRegistrationsModule } from "./modules/registrations/registrations.module.js";
import { createAppProfileModule } from "./modules/app-profile/index.js";
import { createAccountDeletionPurgeModule } from "./modules/account-deletion-purge/index.js";
import { createPublicAccountDeletionModule } from "./modules/public-account-deletion/index.js";
import { createTestSlotModule } from "./modules/test-slots/index.js";
import { createInterviewSlotModule } from "./modules/interview-slots/index.js";

const environment = loadEnvironment();
const prisma = createPrismaClient(environment);
const notificationsModule = createNotificationsModule(prisma, environment);
const usersModule = createUsersModule(prisma);
const authenticationModule = createAuthenticationModule(prisma, notificationsModule.notificationService, environment);
const recruitmentCyclesModule = createRecruitmentCyclesModule(prisma);
const registrationsModule = createRegistrationsModule(
  prisma,
  recruitmentCyclesModule,
  usersModule,
  notificationsModule.notificationService,
);
const appProfileModule = createAppProfileModule(prisma, authenticationModule.denylist);
const accountDeletionPurgeModule = createAccountDeletionPurgeModule(
  prisma,
  authenticationModule.denylist,
);
const publicAccountDeletionModule = createPublicAccountDeletionModule(
  prisma,
  notificationsModule.notificationService,
  environment.VERIFICATION_HASH_SECRET,
  environment.APP_URL,
);
const testSlotModule = createTestSlotModule(prisma);
const interviewSlotModule = createInterviewSlotModule(prisma);

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
  { controller: testSlotModule.controller },
  { controller: usersModule.controller },
  { controller: interviewSlotModule.controller },
  { controller: publicAccountDeletionModule.controller },
);

// Only where the host cannot run `pnpm start:worker` as its own process. SMTP
// configuration is read here rather than at module load so that a deployment
// running the worker separately still needs no SMTP variables on the API.
const emailWorker = environment.WORKER_IN_PROCESS
  ? createEmailWorker(prisma, loadEmailWorkerEnvironment())
  : null;

if (emailWorker !== null) {
  emailWorker.start();
  console.info("Email worker started in-process (WORKER_IN_PROCESS=true)");
}

const server = app.listen(environment.PORT, () => {
  console.info(`Backend listening on port ${environment.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down`);
  server.close(async () => {
    await accountDeletionPurgeModule.scheduler.stop();
    await emailWorker?.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
