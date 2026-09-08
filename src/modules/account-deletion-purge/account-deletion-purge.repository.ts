import type { PrismaClient } from "../../../generated/prisma/client.js";

export class AccountDeletionPurgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findDueForPurge(cutoff: Date): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: { deletionRequestedAt: { lte: cutoff }, anonymizedAt: null },
      select: { id: true },
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
