import type { PrismaClient, User } from "../../../generated/prisma/client.js";

export class PrismaUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByNormalizedEmail = (normalizedEmail: string): Promise<User | null> => {
    return this.prisma.user.findUnique({ where: { normalizedEmail } });
  };

  create = (input: {
    collegeEmail: string;
    personalEmail?: string | null;
    normalizedEmail: string;
    passwordHash?: string | null;
    emailVerifiedAt?: Date | null;
    fullName?: string | null;
    phone?: string | null;
    batch?: string | null;
    year?: number | null;
  }): Promise<User> => {
    return this.prisma.user.create({ data: input });
  };
}
