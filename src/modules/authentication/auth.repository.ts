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

  findEligibleStudentByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        normalizedEmail,
        role: PlatformRole.FIRST_YEAR_STUDENT,
        isSuspended: false,
        registrations: {
          some: {
            paymentStatus: PaymentStatus.PAID,
            recruitmentCycle: { isActive: true },
          },
        },
      },
    });
  }

  findEligibleStudentById(userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        role: PlatformRole.FIRST_YEAR_STUDENT,
        isSuspended: false,
        registrations: {
          some: {
            paymentStatus: PaymentStatus.PAID,
            recruitmentCycle: { isActive: true },
          },
        },
      },
    });
  }

  invalidatePendingEmailVerification(userId: string, now: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.verificationCode.updateMany({
      where: {
        userId,
        purpose: VerificationCodePurpose.EMAIL_VERIFICATION,
        usedAt: null,
        invalidatedAt: null,
      },
      data: { invalidatedAt: now, actionTokenUsedAt: now },
    });
  }

  findLatestEmailVerification(userId: string): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: { userId, purpose: VerificationCodePurpose.EMAIL_VERIFICATION },
      orderBy: { createdAt: "desc" },
    });
  }

  createEmailVerification(input: {
    userId: string;
    normalizedEmail: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
  }): Promise<VerificationCode> {
    return this.prisma.verificationCode.create({
      data: { ...input, purpose: VerificationCodePurpose.EMAIL_VERIFICATION },
    });
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
