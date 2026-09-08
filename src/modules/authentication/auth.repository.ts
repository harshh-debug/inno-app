import {
  PaymentStatus,
  PlatformRole,
  VerificationCodePurpose,
  type Prisma,
  type PrismaClient,
  type User,
  type VerificationCode,
} from "../../../generated/prisma/client.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class AuthRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  findUserByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { normalizedEmail } });
  }

  findUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  // BUG FIX: this used to filter role: REGISTERED unconditionally, which locked a student
  // out of the entire /app namespace — including GET /me — the moment they got promoted to
  // MEMBER/COORDINATOR. That contradicted the app contract's own GET /me docs, which describe
  // `role`/`domain` reflecting a promotion. REGISTERED still needs the current recruitment
  // check (paid, active cycle) since that's what "eligible applicant" means; MEMBER/COORDINATOR
  // don't re-prove that every cycle — they already cleared it once to get promoted, and an old
  // cycle flipping isActive=false shouldn't retroactively lock out an existing club member.
  findEligibleStudentByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        isSuspended: false,
        OR: [
          {
            role: PlatformRole.REGISTERED,
            registrations: { some: { paymentStatus: PaymentStatus.PAID, recruitmentCycle: { isActive: true } } },
          },
          { role: { in: [PlatformRole.MEMBER, PlatformRole.COORDINATOR] } },
        ],
      },
    });
  }

  findEligibleStudentById(userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        isSuspended: false,
        OR: [
          {
            role: PlatformRole.REGISTERED,
            registrations: { some: { paymentStatus: PaymentStatus.PAID, recruitmentCycle: { isActive: true } } },
          },
          { role: { in: [PlatformRole.MEMBER, PlatformRole.COORDINATOR] } },
        ],
      },
    });
  }

  invalidatePendingEmailVerification(userId: string, now: Date): Promise<Prisma.BatchPayload> {
    return this.invalidatePendingCode(userId, VerificationCodePurpose.EMAIL_VERIFICATION, now);
  }

  findLatestEmailVerification(userId: string): Promise<VerificationCode | null> {
    return this.findLatestCode(userId, VerificationCodePurpose.EMAIL_VERIFICATION);
  }

  createEmailVerification(input: {
    userId: string;
    normalizedEmail: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
  }): Promise<VerificationCode> {
    return this.createCode(VerificationCodePurpose.EMAIL_VERIFICATION, input);
  }

  // Gap 1 — password reset. Same table, same shape, `PASSWORD_RESET` purpose
  // so a code issued for one flow can never be verified by the other.
  invalidatePendingPasswordReset(userId: string, now: Date): Promise<Prisma.BatchPayload> {
    return this.invalidatePendingCode(userId, VerificationCodePurpose.PASSWORD_RESET, now);
  }

  findLatestPasswordReset(userId: string): Promise<VerificationCode | null> {
    return this.findLatestCode(userId, VerificationCodePurpose.PASSWORD_RESET);
  }

  createPasswordReset(input: {
    userId: string;
    normalizedEmail: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
  }): Promise<VerificationCode> {
    return this.createCode(VerificationCodePurpose.PASSWORD_RESET, input);
  }

  private invalidatePendingCode(
    userId: string,
    purpose: VerificationCodePurpose,
    now: Date,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.verificationCode.updateMany({
      where: { userId, purpose, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now, actionTokenUsedAt: now },
    });
  }

  private findLatestCode(userId: string, purpose: VerificationCodePurpose): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
      orderBy: { createdAt: "desc" },
    });
  }

  private createCode(
    purpose: VerificationCodePurpose,
    input: {
      userId: string;
      normalizedEmail: string;
      codeHash: string;
      expiresAt: Date;
      resendAvailableAt: Date;
    },
  ): Promise<VerificationCode> {
    return this.prisma.verificationCode.create({ data: { ...input, purpose } });
  }

  incrementFailedAttempt(code: VerificationCode, now: Date): Promise<VerificationCode> {
    const failedAttempts = code.failedAttempts + 1;
    return this.prisma.verificationCode.update({
      where: { id: code.id },
      data: {
        failedAttempts,
        invalidatedAt: failedAttempts >= code.maxAttempts ? now : undefined,
      },
    });
  }

  markCodeVerified(input: {
    codeId: string;
    now: Date;
    actionTokenHash: string;
    actionTokenExpiresAt: Date;
  }): Promise<Prisma.BatchPayload> {
    return this.prisma.verificationCode.updateMany({
      where: {
        id: input.codeId,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: input.now },
      },
      data: {
        usedAt: input.now,
        actionTokenHash: input.actionTokenHash,
        actionTokenExpiresAt: input.actionTokenExpiresAt,
      },
    });
  }

  invalidateCode(codeId: string, now: Date): Promise<VerificationCode> {
    return this.prisma.verificationCode.update({ where: { id: codeId }, data: { invalidatedAt: now } });
  }

  findActionToken(actionTokenHash: string): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findUnique({ where: { actionTokenHash } });
  }

  consumeActionToken(codeId: string, now: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.verificationCode.updateMany({
      where: { id: codeId, actionTokenUsedAt: null, actionTokenExpiresAt: { gt: now } },
      data: { actionTokenUsedAt: now },
    });
  }

  setStudentPassword(userId: string, passwordHash: string, now: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerifiedAt: now },
    });
  }
}
