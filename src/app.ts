import express, { type Express } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { HealthController } from "./health/health.controller.js";
import { createHealthRouter } from "./health/health.routes.js";
import { HealthService } from "./health/health.service.js";
import {
  createApiV1Router,
  type AppProfileRouterDependencies,
  type AuthenticationRouterDependencies,
  type RecruitmentCyclesRouterDependencies,
  type RegistrationsRouterDependencies,
  type TestSlotsRouterDependencies,
  type UsersRouterDependencies,
  type InterviewSlotsRouterDependencies,
} from "./common/http/api-v1.router.js";
import { errorHandler, notFoundHandler } from "./common/http/error.middleware.js";
import type { PublicAccountDeletionController } from "./modules/public-account-deletion/public-account-deletion.controller.js";
import { createPublicAccountDeletionRouter } from "./modules/public-account-deletion/public-account-deletion.routes.js";

export function createApp(
  prisma: PrismaClient,
  authentication?: AuthenticationRouterDependencies,
  recruitmentCycles?: RecruitmentCyclesRouterDependencies,
  registrations?: RegistrationsRouterDependencies,
  appProfile?: AppProfileRouterDependencies,
  testSlots?: TestSlotsRouterDependencies,
  users?: UsersRouterDependencies,
  interviewSlots?: InterviewSlotsRouterDependencies,
  publicAccountDeletion?: { controller: PublicAccountDeletionController },
): Express {
  const app = express();
  const healthService = new HealthService(prisma);
  const healthController = new HealthController(healthService);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  // Plain HTML <form> submissions (delete-account page) post urlencoded, not JSON.
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(createHealthRouter(healthController));
  if (publicAccountDeletion !== undefined) {
    app.use(createPublicAccountDeletionRouter(publicAccountDeletion.controller));
  }
  app.use(
    "/api/v1",
    createApiV1Router(
      authentication,
      recruitmentCycles,
      registrations,
      appProfile,
      testSlots,
      users,
      interviewSlots,
    ),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
