import type { Prisma, PrismaClient, TestResult } from "../../../generated/prisma/client.js";
import type {
  ActiveSubmissionForBooking,
  AdminTestSlot,
  AdminTestSlotBookingRow,
  AdminTestSlotDetail,
  AppTestSlot,
  AppTestSlotBooking,
  BookableTestSlot,
  CreateTestSlotInput,
  TestResultUpdate,
  TestSlotForBooking,
  TestSlotRepository,
  UpdateTestSlotInput,
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
        decision: true,
        recruitmentCycle: { select: { testSlotSwitchingEnabled: true } },
      },
    });
    if (submission === null) {
      return null;
    }
    return {
      id: submission.id,
      paymentStatus: submission.paymentStatus,
      decision: submission.decision,
      testSlotSwitchingEnabled: submission.recruitmentCycle.testSlotSwitchingEnabled,
    };
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

  /**
   * Only returns a slot in the active recruitment cycle. `isVisible` isn't
   * checked here — that flag no longer gates anything now that students
   * never browse a slot list (admin assigns directly), it only affects the
   * admin CRUD listing itself.
   */
  findSlotById = async (testSlotId: string): Promise<TestSlotForBooking | null> => {
    const slot = await this.prisma.testSlot.findFirst({
      where: { id: testSlotId, recruitmentCycle: { isActive: true } },
      select: { id: true, capacity: true },
    });
    return slot;
  };

  /** Student-facing lookup: active cycle only, with the fields needed to decide whether it's open. */
  findBookableSlotById = async (testSlotId: string): Promise<BookableTestSlot | null> => {
    return this.prisma.testSlot.findFirst({
      where: { id: testSlotId, recruitmentCycle: { isActive: true } },
      select: { id: true, capacity: true, isVisible: true, startTime: true },
    });
  };

  /** Visible upcoming slots, plus the student's own slot even if it is hidden or already started. */
  listSlotsForStudent = async (submissionId: string, now: Date): Promise<AppTestSlot[]> => {
    const slots = await this.prisma.testSlot.findMany({
      where: {
        recruitmentCycle: { isActive: true },
        OR: [{ isVisible: true, startTime: { gt: now } }, { bookings: { some: { submissionId } } }],
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        capacity: true,
        bookedCount: true,
        bookings: { where: { submissionId }, select: { id: true } },
      },
    });

    return slots.map((slot) => ({
      testSlotId: slot.id,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      capacity: slot.capacity,
      remaining: Math.max(slot.capacity - slot.bookedCount, 0),
      isMine: slot.bookings.length > 0,
    }));
  };

  /** Compare-and-swap on the current slot, so two racing switches can't both release the same seat. */
  moveBooking = async (
    submissionId: string,
    fromSlotId: string,
    toSlotId: string,
  ): Promise<AppTestSlotBooking | null> => {
    const moved = await this.prisma.testSlotBooking.updateMany({
      where: { submissionId, testSlotId: fromSlotId },
      data: { testSlotId: toSlotId, bookedAt: new Date() },
    });
    if (moved.count !== 1) {
      return null;
    }
    const booking = await this.findBookingForSubmission(submissionId);
    return booking;
  };

  setTestResult = async (submissionId: string, result: TestResult): Promise<TestResultUpdate> => {
    const updated = await this.prisma.registrationSubmission.update({
      where: { id: submissionId },
      data: { testResult: result, testResultUpdatedAt: new Date() },
      select: { id: true, testResult: true, testResultUpdatedAt: true },
    });
    return {
      registrationId: updated.id,
      testResult: updated.testResult,
      testResultUpdatedAt: (updated.testResultUpdatedAt ?? new Date()).toISOString(),
    };
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

  submissionExists = async (submissionId: string): Promise<boolean> => {
    const submission = await this.prisma.registrationSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    return submission !== null;
  };

  reassignBooking = async (submissionId: string, testSlotId: string): Promise<AppTestSlotBooking> => {
    const booking = await this.prisma.testSlotBooking.update({
      where: { submissionId },
      data: { testSlotId, bookedAt: new Date() },
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

  cycleExists = async (cycleId: string): Promise<boolean> => {
    const cycle = await this.prisma.recruitmentCycle.findUnique({ where: { id: cycleId }, select: { id: true } });
    return cycle !== null;
  };

  listForCycle = async (cycleId: string): Promise<AdminTestSlot[]> => {
    const slots = await this.prisma.testSlot.findMany({
      where: { recruitmentCycleId: cycleId },
      orderBy: { order: "asc" },
    });
    return slots.map(toAdminTestSlot);
  };

  findDetailById = async (testSlotId: string): Promise<AdminTestSlotDetail | null> => {
    const slot = await this.prisma.testSlot.findUnique({ where: { id: testSlotId } });
    if (slot === null) {
      return null;
    }
    return {
      id: slot.id,
      recruitmentCycleId: slot.recruitmentCycleId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      order: slot.order,
      isVisible: slot.isVisible,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
    };
  };

  createSlotForCycle = async (cycleId: string, input: CreateTestSlotInput): Promise<AdminTestSlot> => {
    const highestOrder = await this.prisma.testSlot.aggregate({
      where: { recruitmentCycleId: cycleId },
      _max: { order: true },
    });
    const nextOrder = (highestOrder._max.order ?? -1) + 1;

    const slot = await this.prisma.testSlot.create({
      data: {
        recruitmentCycleId: cycleId,
        startTime: input.startTime,
        endTime: input.endTime,
        isVisible: input.isVisible,
        capacity: input.capacity,
        order: nextOrder,
      },
    });
    return toAdminTestSlot(slot);
  };

  updateSlot = async (testSlotId: string, input: UpdateTestSlotInput): Promise<AdminTestSlot> => {
    const slot = await this.prisma.testSlot.update({
      where: { id: testSlotId },
      data: {
        startTime: input.startTime,
        endTime: input.endTime,
        isVisible: input.isVisible,
        capacity: input.capacity,
      },
    });
    return toAdminTestSlot(slot);
  };

  /** Two-phase (negative, then final) update avoids the [cycleId, order] unique-constraint collision mid-reorder. */
  setSlotOrder = async (testSlotId: string, order: number): Promise<void> => {
    await this.prisma.testSlot.update({ where: { id: testSlotId }, data: { order } });
  };

  listBookingsForSlot = async (testSlotId: string): Promise<AdminTestSlotBookingRow[]> => {
    const bookings = await this.prisma.testSlotBooking.findMany({
      where: { testSlotId },
      orderBy: { bookedAt: "asc" },
      select: {
        bookedAt: true,
        submission: {
          select: {
            applicationNumber: true,
            user: { select: { collegeEmail: true, fullName: true } },
          },
        },
      },
    });

    return bookings.map((booking) => ({
      applicationNumber: booking.submission.applicationNumber,
      collegeEmail: booking.submission.user.collegeEmail,
      fullName: booking.submission.user.fullName,
      bookedAt: booking.bookedAt.toISOString(),
    }));
  };
}

function toAdminTestSlot(slot: {
  id: string;
  recruitmentCycleId: string;
  startTime: Date;
  endTime: Date;
  order: number;
  isVisible: boolean;
  capacity: number;
  bookedCount: number;
}): AdminTestSlot {
  return {
    id: slot.id,
    recruitmentCycleId: slot.recruitmentCycleId,
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
    order: slot.order,
    isVisible: slot.isVisible,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
    remainingSeats: Math.max(slot.capacity - slot.bookedCount, 0),
  };
}
