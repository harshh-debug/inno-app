import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type {
  ActiveSubmissionForBooking,
  AppTestSlot,
  AppTestSlotBooking,
  TestSlotForBooking,
  TestSlotRepository,
} from "./test-slot.types.js";

type TestSlotDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for test-slot listing, booking, and capacity accounting. */
export class PrismaTestSlotRepository implements TestSlotRepository {
  constructor(private readonly prisma: TestSlotDatabaseClient) {}

  findActiveSubmissionForUser = async (userId: string): Promise<ActiveSubmissionForBooking | null> => {
    const submission = await this.prisma.registrationSubmission.findFirst({
      where: { userId, recruitmentCycle: { isActive: true } },
      select: {
        id: true,
        paymentStatus: true,
        testSlotBooking: { select: { testSlotId: true } },
      },
    });

    if (submission === null) {
      return null;
    }

    return {
      id: submission.id,
      paymentStatus: submission.paymentStatus,
      bookedTestSlotId: submission.testSlotBooking?.testSlotId ?? null,
    };
  };

  listVisibleSlotsForActiveCycle = async (): Promise<AppTestSlot[]> => {
    const slots = await this.prisma.testSlot.findMany({
      where: { isVisible: true, recruitmentCycle: { isActive: true } },
      orderBy: { order: "asc" },
      select: { id: true, startTime: true, endTime: true, capacity: true, bookedCount: true },
    });

    return slots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      available: slot.bookedCount < slot.capacity,
    }));
  };

  findBookingForSubmission = async (submissionId: string): Promise<AppTestSlotBooking | null> => {
    const booking = await this.prisma.testSlotBooking.findUnique({
      where: { submissionId },
      select: {
        testSlotId: true,
        bookedAt: true,
        testSlot: { select: { startTime: true, endTime: true } },
      },
    });

    if (booking === null) {
      return null;
    }

    return {
      testSlotId: booking.testSlotId,
      startTime: booking.testSlot.startTime.toISOString(),
      endTime: booking.testSlot.endTime.toISOString(),
      bookedAt: booking.bookedAt.toISOString(),
    };
  };

  /** Only returns a slot that is visible and belongs to the active recruitment cycle. */
  findSlotById = async (testSlotId: string): Promise<TestSlotForBooking | null> => {
    const slot = await this.prisma.testSlot.findFirst({
      where: { id: testSlotId, isVisible: true, recruitmentCycle: { isActive: true } },
      select: { id: true, capacity: true },
    });
    return slot;
  };

  /** Atomic conditional increment — mirrors RegistrationRepository.transitionPaymentStatus. */
  tryReserveSeat = async (testSlotId: string, capacity: number): Promise<boolean> => {
    const changed = await this.prisma.testSlot.updateMany({
      where: { id: testSlotId, bookedCount: { lt: capacity } },
      data: { bookedCount: { increment: 1 } },
    });
    return changed.count === 1;
  };

  releaseSeat = async (testSlotId: string): Promise<void> => {
    await this.prisma.testSlot.update({
      where: { id: testSlotId },
      data: { bookedCount: { decrement: 1 } },
    });
  };

  createBooking = async (submissionId: string, testSlotId: string): Promise<AppTestSlotBooking> => {
    const booking = await this.prisma.testSlotBooking.create({
      data: { submissionId, testSlotId },
      select: {
        testSlotId: true,
        bookedAt: true,
        testSlot: { select: { startTime: true, endTime: true } },
      },
    });

    return {
      testSlotId: booking.testSlotId,
      startTime: booking.testSlot.startTime.toISOString(),
      endTime: booking.testSlot.endTime.toISOString(),
      bookedAt: booking.bookedAt.toISOString(),
    };
  };
}
