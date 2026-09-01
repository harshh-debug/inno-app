import { AppError } from "../../common/errors.js";
import { PaymentStatus } from "../../../generated/prisma/client.js";
import type {
  AdminInterviewBookingRow,
  AdminInterviewSlot,
  AppInterviewBooking,
  CreateInterviewSlotInput,
  InterviewSlotRepository,
  UpdateInterviewSlotInput,
} from "./interview-slot.types.js";

type TransactionRunner = <T>(operation: (repository: InterviewSlotRepository) => Promise<T>) => Promise<T>;

/**
 * Interview scheduling. Admin assigns a submission to a slot; the student
 * only ever reads their own assignment (no self-booking) — same model as
 * TestSlotService.
 */
export class InterviewSlotService {
  constructor(
    private readonly repository: InterviewSlotRepository,
    private readonly transaction: TransactionRunner,
  ) {}

  async getMyBooking(userId: string): Promise<AppInterviewBooking> {
    const submission = await this.repository.findActiveSubmissionForUser(userId);
    if (submission === null || submission.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }

    const booking = await this.repository.findBookingForSubmission(submission.id);
    if (booking === null) {
      throw new AppError("INTERVIEW_SLOT_NOT_BOOKED", 404, "No interview slot assigned yet");
    }
    return booking;
  }

  /** Admin assigns (or reassigns) a submission to an interview slot — see TestSlotService.assignSlot. */
  async assignSlot(submissionId: string, interviewSlotId: string): Promise<AppInterviewBooking> {
    return this.transaction(async (repository) => {
      if (!(await repository.submissionExists(submissionId))) {
        throw new AppError("REGISTRATION_SUBMISSION_NOT_FOUND", 404, "Registration submission not found");
      }

      const slot = await repository.findSlotById(interviewSlotId);
      if (slot === null) {
        throw new AppError("INTERVIEW_SLOT_NOT_FOUND", 404, "Interview slot not found");
      }

      const existingBooking = await repository.findBookingForSubmission(submissionId);
      if (existingBooking !== null && existingBooking.interviewSlotId === interviewSlotId) {
        return existingBooking;
      }

      const reserved = await repository.tryReserveSeat(interviewSlotId, slot.capacity);
      if (!reserved) {
        throw new AppError("INTERVIEW_SLOT_FULL", 409, "Interview slot has no remaining capacity");
      }

      if (existingBooking !== null) {
        await repository.releaseSeat(existingBooking.interviewSlotId);
        return repository.reassignBooking(submissionId, interviewSlotId);
      }

      return repository.createBooking(submissionId, interviewSlotId);
    });
  }

  async listSlotsForCycle(cycleId: string): Promise<AdminInterviewSlot[]> {
    await this.requireCycleExists(cycleId);
    return this.repository.listForCycle(cycleId);
  }

  async createSlot(cycleId: string, input: CreateInterviewSlotInput): Promise<AdminInterviewSlot> {
    return this.transaction(async (repository) => {
      if (!(await repository.cycleExists(cycleId))) {
        throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
      }
      return repository.createSlotForCycle(cycleId, input);
    });
  }

  /** `confirmTimeChange` mirrors TestSlotService.updateSlot's booked-slot time-change gate. */
  async updateSlot(
    interviewSlotId: string,
    input: UpdateInterviewSlotInput,
    confirmTimeChange: boolean,
  ): Promise<AdminInterviewSlot> {
    return this.transaction(async (repository) => {
      const slot = await repository.findDetailById(interviewSlotId);
      if (slot === null) {
        throw new AppError("INTERVIEW_SLOT_NOT_FOUND", 404, "Interview slot not found");
      }

      if (input.capacity !== undefined && input.capacity < slot.bookedCount) {
        throw new AppError(
          "INTERVIEW_SLOT_CAPACITY_BELOW_BOOKINGS",
          400,
          `Capacity cannot be reduced below the ${slot.bookedCount} existing assignment(s)`,
        );
      }

      const changesTime =
        (input.startTime !== undefined && input.startTime.getTime() !== slot.startTime.getTime()) ||
        (input.endTime !== undefined && input.endTime.getTime() !== slot.endTime.getTime());
      if (changesTime && slot.bookedCount > 0 && !confirmTimeChange) {
        throw new AppError(
          "INTERVIEW_SLOT_TIME_CHANGE_REQUIRES_CONFIRMATION",
          409,
          `This slot has ${slot.bookedCount} existing assignment(s); resubmit with confirmTimeChange: true to change its time`,
        );
      }

      return repository.updateSlot(interviewSlotId, input);
    });
  }

  async listBookings(interviewSlotId: string): Promise<AdminInterviewBookingRow[]> {
    const slot = await this.repository.findDetailById(interviewSlotId);
    if (slot === null) {
      throw new AppError("INTERVIEW_SLOT_NOT_FOUND", 404, "Interview slot not found");
    }
    return this.repository.listBookingsForSlot(interviewSlotId);
  }

  private async requireCycleExists(cycleId: string): Promise<void> {
    if (!(await this.repository.cycleExists(cycleId))) {
      throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
    }
  }
}
