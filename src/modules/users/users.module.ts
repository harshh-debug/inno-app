import { type Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaUserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

/**
 * Composition root for global user identity.
 */
export function createUsersModule(prisma: PrismaClient) {
  const userRepository = new PrismaUserRepository(prisma);
  const userService = new UserService(userRepository);

  return {
    userRepository,
    userService,
    /** Use inside a caller-owned Prisma transaction, never inside a request handler. */
    forTransaction(transaction: Prisma.TransactionClient) {
      const transactionRepository = new PrismaUserRepository(transaction);
      return {
        userRepository: transactionRepository,
        userService: new UserService(transactionRepository),
      };
    },
  };
}
