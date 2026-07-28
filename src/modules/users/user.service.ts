import { PlatformRole, type User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import { deriveAccountState, type DerivedAccountState } from "./account-state.js";
import { normalizeEmail } from "./email.js";
import type {
  ControlledAdminProvisioningInput,
  FindOrCreateUserResult,
  ProvisionalStudentInput,
  RegistrationUserProfileInput,
  UserRepository,
} from "./user.types.js";

/**
 * Owns identity matching and the limited profile mutation allowed by public
 * registration. Registration submission creation stays in the registrations
 * module, which supplies a transaction-bound instance of this service.
 */
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findOrCreateProvisionalStudent(
    input: ProvisionalStudentInput,
  ): Promise<FindOrCreateUserResult> {
    const normalizedEmail = normalizeEmail(input.collegeEmail);
    const profile = this.toStoredProfile(input);
    const existingUser = await this.userRepository.findByNormalizedEmail(normalizedEmail);

    if (existingUser !== null) {
      return this.reuseStudent(existingUser, profile);
    }

    try {
      const user = await this.userRepository.createProvisionalStudent({
        ...profile,
        normalizedEmail,
      });
      return { user, created: true };
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      // A concurrent registration created the same normalized identity. Read
      // it back and apply the same compatible-role and profile rules.
      const concurrentUser = await this.userRepository.findByNormalizedEmail(normalizedEmail);
      if (concurrentUser === null) {
        throw error;
      }

      return this.reuseStudent(concurrentUser, profile);
    }
  }

  async getUserWithAccountState(userId: string): Promise<{
    user: User;
    accountState: DerivedAccountState;
  }> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new AppError("USER_NOT_FOUND", 404, "User not found");
    }

    return { user, accountState: deriveAccountState(user) };
  }

  /**
   * For authenticated admin/bootstrap flows only. This operation never
   * changes the role of an existing identity, preventing a public student
   * email from being silently elevated.
   */
  async provisionControlledAdmin(
    input: ControlledAdminProvisioningInput,
  ): Promise<FindOrCreateUserResult> {
    const normalizedEmail = normalizeEmail(input.collegeEmail);
    const existingUser = await this.userRepository.findByNormalizedEmail(normalizedEmail);

    if (existingUser !== null) {
      if (existingUser.role !== input.role) {
        throw this.incompatibleRoleError();
      }

      return { user: existingUser, created: false };
    }

    try {
      const user = await this.userRepository.createControlledAdmin({
        ...this.toStoredProfile(input),
        normalizedEmail,
        role: input.role,
        passwordHash: input.passwordHash,
        emailVerifiedAt: new Date(),
      });
      return { user, created: true };
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }

      const concurrentUser = await this.userRepository.findByNormalizedEmail(normalizedEmail);
      if (concurrentUser === null) {
        throw error;
      }
      if (concurrentUser.role !== input.role) {
        throw this.incompatibleRoleError();
      }

      return { user: concurrentUser, created: false };
    }
  }

  private async reuseStudent(
    existingUser: User,
    profile: ReturnType<UserService["toStoredProfile"]>,
  ): Promise<FindOrCreateUserResult> {
    if (existingUser.role !== PlatformRole.FIRST_YEAR_STUDENT) {
      throw this.incompatibleRoleError();
    }

    const user = await this.userRepository.updateSubmittedProfile(existingUser.id, profile);
    return { user, created: false };
  }

  private toStoredProfile(input: RegistrationUserProfileInput) {
    return {
      collegeEmail: input.collegeEmail.trim(),
      personalEmail: input.personalEmail?.trim() || null,
      fullName: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
      batch: input.batch?.trim() || null,
      year: input.year ?? null,
    };
  }

  private incompatibleRoleError(): AppError {
    return new AppError(
      "USER_ROLE_CONFLICT",
      409,
      "This college email belongs to an account that cannot use first-year registration",
    );
  }
}
