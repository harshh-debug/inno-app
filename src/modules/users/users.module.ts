import type { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaUserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

/**
 * Composition root for global user identity.
 */
export function createUsersModule(prisma: PrismaClient) {
  const userRepository = new PrismaUserRepository(prisma);
  const userService = new UserService(userRepository);

  return { userRepository, userService };
}
