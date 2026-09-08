import {
  PlatformRole,
  VerificationCodePurpose,
  type PrismaClient,
  type User,
  type VerificationCode,
} from "../../../generated/prisma/client.js";

export class PublicAccountDeletionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ADMIN accounts are excluded — this is the self-service consumer flow,
  // same boundary the app namespace itself never crosses.
  findDeletableUserByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { normalizedEmail, role: { not: PlatformRole.ADMIN } },
    });
  }

  findLatestPending(userId: string): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: { userId, purpose: VerificationCodePurpose.ACCOUNT_DELETION, usedAt: null, invalidatedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  async invalidatePending(userId: string, now: Date): Promise<void> {
    await this.prisma.verificationCode.updateMany({
      where: { userId, purpose: VerificationCodePurpose.ACCOUNT_DELETION, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now },
    });
  }

  createRequest(input: {
    userId: string;
    normalizedEmail: string;
    codeHash: string;
    expiresAt: Date;
    resendAvailableAt: Date;
  }): Promise<VerificationCode> {
    return this.prisma.verificationCode.create({
      data: { ...input, purpose: VerificationCodePurpose.ACCOUNT_DELETION },
    });
  }

  // Token is embedded in the emailed link, not typed, so lookup is by
  // normalizedEmail (from the link) + a fresh hash of the token (from the
  // link) rather than an attempt-limited "enter this code" flow.
  findLive(normalizedEmail: string, codeHash: string, now: Date): Promise<VerificationCode | null> {
    return this.prisma.verificationCode.findFirst({
      where: {
        normalizedEmail,
        purpose: VerificationCodePurpose.ACCOUNT_DELETION,
        codeHash,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
    });
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.prisma.verificationCode.update({ where: { id }, data: { usedAt: now } });
  }

  async applyDeletionRequest(userId: string, now: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: now } });
  }
}
