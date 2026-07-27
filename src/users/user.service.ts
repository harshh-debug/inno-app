import { normalizeEmail } from "../common/hash.js";
import { isPrismaUniqueConstraintError } from "../common/prisma-errors.js";
import type { CreateUserInput, FindOrCreateUserResult, UserRepository } from "./user.types.js";

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  findOrCreateByEmail = async (input: CreateUserInput): Promise<FindOrCreateUserResult> => {
    const normalizedEmail = normalizeEmail(input.collegeEmail);
    const existingUser = await this.userRepository.findByNormalizedEmail(normalizedEmail);

    if (existingUser !== null) {
      return { user: existingUser, created: false };
    }

    const createInput = {
      collegeEmail: input.collegeEmail.trim(),
      personalEmail: input.personalEmail ?? null,
      normalizedEmail,
      passwordHash: input.passwordHash ?? null,
      emailVerifiedAt: input.emailVerifiedAt ?? null,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      batch: input.batch ?? null,
      year: input.year ?? null,
    } satisfies Parameters<UserRepository["create"]>[0];

    try {
      const user = await this.userRepository.create(createInput);
      return { user, created: true };
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const user = await this.userRepository.findByNormalizedEmail(normalizedEmail);

      if (user !== null) {
        return { user, created: false };
      }

      throw error;
    }
  };
}
