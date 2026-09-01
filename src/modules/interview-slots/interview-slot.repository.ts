import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type {
  ActiveSubmissionForInterview,
  AdminInterviewBookingRow,
  AdminInterviewSlot,
  AdminInterviewSlotDetail,
  AppInterviewBooking,
  CreateInterviewSlotInput,
  InterviewSlotForAssignment,
  InterviewSlotRepository,
  UpdateInterviewSlotInput,
} from "./interview-slot.types.js";

type InterviewSlotDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for interview scheduling, assignment, and capacity accounting. */
export class PrismaInterviewSlotRepository implements InterviewSlotRepository {
  constructor(private readonly prisma: InterviewSlotDatabaseClient) {}

  findActiveSubmissionForUser = async (userId: string): Promise<ActiveSubmissionForInterview | null> => {
    const submission = await this.prisma.registrationSubmission.findFirst({
      where: { userId, recruitmentCycle: { isActive: true } },
      select: { id: true, paymentStatus: true },
    });
    return submission;
  };

  findBookingForSubmission = async (submissionId: string): Promise<AppInterviewBooking | null> => {
    const booking = await this.prisma.slotBooking.findUnique({
      where: { submissionId },
      select: {
        slotId: true,
        bookedAt: true,
        slot: { select: { startTime: true, endTime: true, location: true, meetingUrl: true } },
      },
    });
    return booking === null ? null : toAppInterviewBooking(booking);
  };

  /** Only returns a non-cancelled slot in the active recruitment cycle. */
  findSlotById = async (interviewSlotId: string): Promise<InterviewSlotForAssignment | null> => {
    const slot = await this.prisma.interviewSlot.findFirst({
      where: { id: interviewSlotId, isCancelled: false, recruitmentCycle: { isActive: true } },
      select: { id: true, capacity: true },
    });
    return slot;
  };

  /** Atomic conditional increment — mirrors PrismaTestSlotRepository.tryReserveSeat. */
  tryReserveSeat = async (interviewSlotId: string, capacity: number): Promise<boolean> => {
    const changed = await this.prisma.interviewSlot.updateMany({
      where: { id: interviewSlotId, bookedCount: { lt: capacity } },
      data: { bookedCount: { increment: 1 } },
    });
    return changed.count === 1;
  };

  releaseSeat = async (interviewSlotId: string): Promise<void> => {
    await this.prisma.interviewSlot.update({
      where: { id: interviewSlotId },
      data: { bookedCount: { decrement: 1 } },
    });
  };

  createBooking = async (submissionId: string, interviewSlotId: string): Promise<AppInterviewBooking> => {
    const booking = await this.prisma.slotBooking.create({
      data: { submissionId, slotId: interviewSlotId },
      select: {
        slotId: true,
        bookedAt: true,
        slot: { select: { startTime: true, endTime: true, location: true, meetingUrl: true } },
      },
    });
    return toAppInterviewBooking(booking);
  };

  reassignBooking = async (submissionId: string, interviewSlotId: string): Promise<AppInterviewBooking> => {
    const booking = await this.prisma.slotBooking.update({
      where: { submissionId },
      data: { slotId: interviewSlotId, bookedAt: new Date() },
      select: {
        slotId: true,
        bookedAt: true,
        slot: { select: { startTime: true, endTime: true, location: true, meetingUrl: true } },
      },
    });
    return toAppInterviewBooking(booking);
  };

  submissionExists = async (submissionId: string): Promise<boolean> => {
    const submission = await this.prisma.registrationSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });
    return submission !== null;
  };

  cycleExists = async (cycleId: string): Promise<boolean> => {
    const cycle = await this.prisma.recruitmentCycle.findUnique({ where: { id: cycleId }, select: { id: true } });
    return cycle !== null;
  };

  listForCycle = async (cycleId: string): Promise<AdminInterviewSlot[]> => {
    const slots = await this.prisma.interviewSlot.findMany({
      where: { recruitmentCycleId: cycleId },
      orderBy: { startTime: "asc" },
    });
    return slots.map(toAdminInterviewSlot);
  };

  findDetailById = async (interviewSlotId: string): Promise<AdminInterviewSlotDetail | null> => {
    const slot = await this.prisma.interviewSlot.findUnique({ where: { id: interviewSlotId } });
    if (slot === null) {
      return null;
    }
    return {
      id: slot.id,
      recruitmentCycleId: slot.recruitmentCycleId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
    };
  };

  createSlotForCycle = async (cycleId: string, input: CreateInterviewSlotInput): Promise<AdminInterviewSlot> => {
    const slot = await this.prisma.interviewSlot.create({
      data: {
        recruitmentCycleId: cycleId,
        interviewerName: input.interviewerName,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location ?? null,
        meetingUrl: input.meetingUrl ?? null,
        capacity: input.capacity,
        isCancelled: input.isCancelled,
      },
    });
    return toAdminInterviewSlot(slot);
  };

  updateSlot = async (interviewSlotId: string, input: UpdateInterviewSlotInput): Promise<AdminInterviewSlot> => {
    const slot = await this.prisma.interviewSlot.update({
      where: { id: interviewSlotId },
      data: {
        interviewerName: input.interviewerName,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        meetingUrl: input.meetingUrl,
        capacity: input.capacity,
        isCancelled: input.isCancelled,
      },
    });
    return toAdminInterviewSlot(slot);
  };

  listBookingsForSlot = async (interviewSlotId: string): Promise<AdminInterviewBookingRow[]> => {
    const bookings = await this.prisma.slotBooking.findMany({
      where: { slotId: interviewSlotId },
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

function toAppInterviewBooking(booking: {
  slotId: string;
  bookedAt: Date;
  slot: { startTime: Date; endTime: Date; location: string | null; meetingUrl: string | null };
}): AppInterviewBooking {
  return {
    interviewSlotId: booking.slotId,
    startTime: booking.slot.startTime.toISOString(),
    endTime: booking.slot.endTime.toISOString(),
    location: booking.slot.location,
    meetingUrl: booking.slot.meetingUrl,
    bookedAt: booking.bookedAt.toISOString(),
  };
}

function toAdminInterviewSlot(slot: {
  id: string;
  recruitmentCycleId: string;
  interviewerName: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  meetingUrl: string | null;
  capacity: number;
  isCancelled: boolean;
  bookedCount: number;
}): AdminInterviewSlot {
  return {
    id: slot.id,
    recruitmentCycleId: slot.recruitmentCycleId,
    interviewerName: slot.interviewerName,
    startTime: slot.startTime.toISOString(),
    endTime: slot.endTime.toISOString(),
    location: slot.location,
    meetingUrl: slot.meetingUrl,
    capacity: slot.capacity,
    isCancelled: slot.isCancelled,
    bookedCount: slot.bookedCount,
    remainingSeats: Math.max(slot.capacity - slot.bookedCount, 0),
  };
}
