import type { User } from "../../../generated/prisma/client.js";

export interface UserProfileInput {
  collegeEmail: string;
  personalEmail?: string | null;
  fullName?: string | null;
  phone?: string | null;
  batch?: string | null;
  year?: number | null;
}

export interface CreateUserInput extends UserProfileInput {
  passwordHash?: string | null;
  emailVerifiedAt?: Date | null;
}

export interface UserRepository {
  findByNormalizedEmail(normalizedEmail: string): Promise<User | null>;
  create(input: {
    collegeEmail: string;
    personalEmail?: string | null;
    normalizedEmail: string;
    passwordHash?: string | null;
    emailVerifiedAt?: Date | null;
    fullName?: string | null;
    phone?: string | null;
    batch?: string | null;
    year?: number | null;
  }): Promise<User>;
}

export interface FindOrCreateUserResult {
  user: User;
  created: boolean;
}
