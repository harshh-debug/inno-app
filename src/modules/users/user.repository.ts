import {
  PlatformRole,
  type Prisma,
  type PrismaClient,
  type User,
} from "../../../generated/prisma/client.js";
import type { UserRepository } from "./user.types.js";

type UserDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for global user identity and profile records. */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: UserDatabaseClient) {}

  findById = (id: string): Promise<User | null> => this.prisma.user.findUnique({ where: { id } });

  findByNormalizedEmail = (normalizedEmail: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { normalizedEmail } });
  };

  createProvisionalStudent = (input: Parameters<UserRepository["createProvisionalStudent"]>[0]): Promise<User> => {
    return this.prisma.user.create({
      data: {
        ...input,
        role: PlatformRole.REGISTERED,
        passwordHash: null,
        emailVerifiedAt: null,
        isSuspended: false,
      },
    });
  };

  updateSubmittedProfile = (
    userId: string,
    input: Parameters<UserRepository["updateSubmittedProfile"]>[1],
  ): Promise<User> => {
    return this.prisma.user.update({ where: { id: userId }, data: input });
  };

  createControlledAdmin = (input: Parameters<UserRepository["createControlledAdmin"]>[0]): Promise<User> => {
    return this.prisma.user.create({
      data: {
        ...input,
        isSuspended: false,
      },
    });
  };

  setRoleAndDomain = (
    userId: string,
    role: Parameters<UserRepository["setRoleAndDomain"]>[1],
    domain: Parameters<UserRepository["setRoleAndDomain"]>[2],
  ): Promise<User> => {
    return this.prisma.user.update({ where: { id: userId }, data: { role, domain } });
  };
}
