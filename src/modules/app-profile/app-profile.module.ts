import type { PrismaClient } from "../../../generated/prisma/client.js";
import { AppProfileController } from "./app-profile.controller.js";
import { PrismaAppProfileRepository } from "./app-profile.repository.js";
import { AppProfileService } from "./app-profile.service.js";

/** Answers gaps 2 (GET /app/me) and 3 (GET /app/recruitment). */
export function createAppProfileModule(prisma: PrismaClient) {
  const repository = new PrismaAppProfileRepository(prisma);
  const service = new AppProfileService(repository);
  const controller = new AppProfileController(service);
  return { repository, service, controller };
}
