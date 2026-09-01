import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { AppProfile, AppProfileRepository, AppProfileUpdate, AppRecruitmentSummary } from "./app-profile.types.js";

/**
 * Reads here already went through `requireAppStudent` (paid, active-cycle,
 * non-suspended) before reaching this repository, so no eligibility
 * filtering happens again down here. `updateProfile` only ever writes
 * fullName/phone — batch/year/role are admin-panel-only.
 */
export class PrismaAppProfileRepository implements AppProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findProfileByUserId(userId: string): Promise<AppProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        collegeEmail: true,
        fullName: true,
        phone: true,
        batch: true,
        year: true,
        role: true,
        domain: true,
      },
    });
    return user;
  }

  async updateProfile(userId: string, input: AppProfileUpdate): Promise<AppProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: input.fullName, phone: input.phone },
      select: {
        collegeEmail: true,
        fullName: true,
        phone: true,
        batch: true,
        year: true,
        role: true,
        domain: true,
      },
    });
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
        slotBooking: {
          select: { slot: { select: { startTime: true, endTime: true, location: true, meetingUrl: true } } },
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
      interview: {
        assigned: registration.slotBooking !== null,
        startTime: registration.slotBooking?.slot.startTime.toISOString() ?? null,
        endTime: registration.slotBooking?.slot.endTime.toISOString() ?? null,
        location: registration.slotBooking?.slot.location ?? null,
        meetingUrl: registration.slotBooking?.slot.meetingUrl ?? null,
      },
    };
  }
}
