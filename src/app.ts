import express, { type Express } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { HealthController } from "./health/health.controller.js";
import { createHealthRouter } from "./health/health.routes.js";
import { HealthService } from "./health/health.service.js";
import { createApiV1Router } from "./common/http/api-v1.router.js";
import { errorHandler, notFoundHandler } from "./common/http/error.middleware.js";
import type { AuthController } from "./modules/authentication/auth.controller.js";

export function createApp(prisma: PrismaClient, authentication?: { controller: AuthController }): Express {
  const app = express();
  const healthService = new HealthService(prisma);
  const healthController = new HealthController(healthService);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(createHealthRouter(healthController));
  app.use("/api/v1", createApiV1Router(authentication));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
