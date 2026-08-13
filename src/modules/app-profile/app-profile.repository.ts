import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AppProfile, AppProfileRepository, AppRecruitmentSummary } from "./app-profile.types.js";

/**
 * Read-only. Everything here already went through `requireAppStudent`
 * (paid, active-cycle, non-suspended) before reaching this repository, so
 * no eligibility filtering happens again down here.
 */
export class PrismaAppProfileRepository implements AppProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findProfileByUserId(userId: string): Promise<AppProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { collegeEmail: true, fullName: true, phone: true, batch: true, year: true, role: true },
    });
    return user;
  }

  async findRecruitmentSummaryByUserId(userId: string): Promise<AppRecruitmentSummary | null> {
    const registration = await this.prisma.registrationSubmission.findFirst({
      where: { userId, recruitmentCycle: { isActive: true } },
      select: {
        paymentStatus: true,
        decision: true,
        decisionNote: true,
        testSlotBooking: {
          select: { testSlot: { select: { startTime: true, endTime: true } } },
        },
      },
    });

    if (registration === null) {
      return null;
    }

    return {
      paid: registration.paymentStatus === "PAID",
      decision: registration.decision,
      decisionNote: registration.decisionNote,
      testSlot: {
        booked: registration.testSlotBooking !== null,
        startTime: registration.testSlotBooking?.testSlot.startTime.toISOString() ?? null,
        endTime: registration.testSlotBooking?.testSlot.endTime.toISOString() ?? null,
      },
    };
  }
}
