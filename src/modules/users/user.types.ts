import type { Domain, PlatformRole, User } from "../../../generated/prisma/client.js";

/** Basic profile values supplied by the public registration workflow. */
export interface RegistrationUserProfileInput {
  collegeEmail: string;
  personalEmail?: string | null;
  fullName?: string | null;
  phone?: string | null;
  batch?: string | null;
  year?: number | null;
}

/**
 * This type deliberately has no password, role, verification, or suspension
 * properties. Public registration may only provide profile information.
 */
export type ProvisionalStudentInput = RegistrationUserProfileInput;

/** Only internal admin/bootstrap code may use this provisioning operation. */
export interface ControlledAdminProvisioningInput extends RegistrationUserProfileInput {
  role: Extract<PlatformRole, "ADMIN" | "COORDINATOR">;
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByNormalizedEmail(normalizedEmail: string): Promise<User | null>;
  createProvisionalStudent(input: {
    collegeEmail: string;
    normalizedEmail: string;
    personalEmail: string | null;
    fullName: string | null;
    phone: string | null;
    batch: string | null;
    year: number | null;
  }): Promise<User>;
  updateSubmittedProfile(
    userId: string,
    input: {
      collegeEmail: string;
      personalEmail: string | null;
      fullName: string | null;
      phone: string | null;
      batch: string | null;
      year: number | null;
    },
  ): Promise<User>;
  createControlledAdmin(input: {
    collegeEmail: string;
    normalizedEmail: string;
    personalEmail: string | null;
    fullName: string | null;
    phone: string | null;
    batch: string | null;
    year: number | null;
    role: Extract<PlatformRole, "ADMIN" | "COORDINATOR">;
    passwordHash: string;
    emailVerifiedAt: Date;
  }): Promise<User>;
  setRoleAndDomain(userId: string, role: PlatformRole, domain: Domain | null): Promise<User>;
}

export interface FindOrCreateUserResult {
  user: User;
  created: boolean;
}

export interface PromoteUserInput {
  role: PlatformRole;
  domain?: Domain;
}
