import type { User } from "../../generated/prisma/client.js";
import { describe, expect, it, vi } from "vitest";
import { UserService } from "./user.service.js";
import type { UserRepository } from "./user.types.js";

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-id",
    collegeEmail: "student@example.com",
    personalEmail: null,
    normalizedEmail: "student@example.com",
    passwordHash: null,
    emailVerifiedAt: null,
    role: "FIRST_YEAR_STUDENT",
    isSuspended: false,
    fullName: null,
    phone: null,
    batch: null,
    year: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    // registrations: [],
    // verificationCodes: [],
    // paymentsVerified: [],
    // decisionsMade: [],
    ...overrides,
  };
}

describe("UserService.findOrCreateByEmail", () => {
  it("reuses an existing user when the normalized email is already present", async () => {
    const existingUser = createUser();
    const userRepository: UserRepository = {
      findByNormalizedEmail: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn(),
    };

    const service = new UserService(userRepository);

    await expect(
      service.findOrCreateByEmail({
        collegeEmail: "  Student@Example.com ",
        personalEmail: null,
      }),
    ).resolves.toEqual({ user: existingUser, created: false });

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it("creates a new user when no matching email exists", async () => {
    const createdUser = createUser();
    const userRepository: UserRepository = {
      findByNormalizedEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createdUser),
    };

    const service = new UserService(userRepository);

    await expect(
      service.findOrCreateByEmail({
        collegeEmail: "Student@Example.com",
        personalEmail: null,
        fullName: "Student Name",
      }),
    ).resolves.toEqual({ user: createdUser, created: true });

    expect(userRepository.create).toHaveBeenCalledWith({
      collegeEmail: "Student@Example.com",
      personalEmail: null,
      normalizedEmail: "student@example.com",
      passwordHash: null,
      emailVerifiedAt: null,
      fullName: "Student Name",
      phone: null,
      batch: null,
      year: null,
    });
  });

  it("falls back to the existing user when create hits a unique email race", async () => {
    const existingUser = createUser();
    const uniqueError = { code: "P2002" };
    const userRepository: UserRepository = {
      findByNormalizedEmail: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser),
      create: vi.fn().mockRejectedValue(uniqueError),
    };

    const service = new UserService(userRepository);

    await expect(
      service.findOrCreateByEmail({
        collegeEmail: "student@example.com",
        personalEmail: null,
      }),
    ).resolves.toEqual({ user: existingUser, created: false });
  });
});
