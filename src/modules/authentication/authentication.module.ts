import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Environment } from "../../config/environment.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AccessTokenService } from "./token.js";

export function createAuthenticationModule(
  prisma: PrismaClient,
  notifications: NotificationService,
  environment: Pick<Environment, "JWT_SECRET" | "VERIFICATION_HASH_SECRET">,
) {
  const repository = new AuthRepository(prisma);
  const tokens = new AccessTokenService(environment.JWT_SECRET);
  const service = new AuthService(
    repository,
    notifications,
    tokens,
    environment.VERIFICATION_HASH_SECRET,
    (operation) => prisma.$transaction((transaction) => operation(new AuthRepository(transaction))),
  );
  const controller = new AuthController(service);
  return { repository, tokens, service, controller };
}
