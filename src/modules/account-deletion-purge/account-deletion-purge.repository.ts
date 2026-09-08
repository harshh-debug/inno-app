import type { PrismaClient } from "../../../generated/prisma/client.js";

export class AccountDeletionPurgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findDueForPurge(cutoff: Date): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: { deletionRequestedAt: { lte: cutoff }, anonymizedAt: null },
      select: { id: true },
    });
  }

  // Replaces BullMQ's `removeOnFail: 1000` retention cap. Failed rows are kept
  // briefly so a delivery problem can still be diagnosed; the OTP left in the
  // payload is inert by then, since codes expire in 10 minutes and
  // VerificationCode governs validity regardless of what this row holds.
  deleteFailedEmailJobs(cutoff: Date): Promise<{ count: number }> {
    return this.prisma.emailJob.deleteMany({
      where: { status: "FAILED", updatedAt: { lt: cutoff } },
    });
  }

  // Clears the fields Play policy requires actually erasing on deletion.
  // The row id, and anything foreign-keyed to it (RegistrationSubmission as
  // Registrant/DecisionMadeBy, AuditLog), survives untouched.
  anonymize(userId: string, now: Date): Promise<unknown> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: null,
        phone: null,
        personalEmail: null,
        collegeEmail: `deleted-${userId}@deleted.innogeeks`,
        normalizedEmail: `deleted-${userId}@deleted.innogeeks`,
        passwordHash: null,
        anonymizedAt: now,
      },
    });
  }
}
