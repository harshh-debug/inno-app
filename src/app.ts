import express, { type Express } from "express";
import type { PrismaClient } from "../generated/prisma/client.js";
import { HealthController } from "./health/health.controller.js";
import { createHealthRouter } from "./health/health.routes.js";
import { HealthService } from "./health/health.service.js";

export function createApp(prisma: PrismaClient): Express {
  const app = express();
  const healthService = new HealthService(prisma);
  const healthController = new HealthController(healthService);

  app.disable("x-powered-by");
  app.use(express.json());
  app.use(createHealthRouter(healthController));

  return app;
}
