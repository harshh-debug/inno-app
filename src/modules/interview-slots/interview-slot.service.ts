import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import { PaymentStatus, RecruitmentDecision, TestResult } from "../../../generated/prisma/client.js";
import type {
  AdminInterviewBookingRow,
  AdminInterviewSlot,
  AppInterviewBooking,
  AppInterviewSlotList,
  CreateInterviewSlotInput,
  InterviewSlotRepository,
  UpdateInterviewSlotInput,
} from "./interview-slot.types.js";

type TransactionRunner = <T>(operation: (repository: InterviewSlotRepository) => Promise<T>) => Promise<T>;

/**
 * Interview scheduling. Students who passed the test book or switch their
 * own slot; admins can still assign/override — same model as TestSlotService.
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

  async listSlotsForStudent(userId: string): Promise<AppInterviewSlotList> {
    const submission = await this.requireOpenSubmission(userId);
    const slots = await this.repository.listSlotsForStudent(submission.id, new Date());
    return { slots, switchingEnabled: submission.interviewSlotSwitchingEnabled };
  }

  /** Student books or switches their interview slot — see TestSlotService.bookSlot. */
  async bookSlot(userId: string, interviewSlotId: string): Promise<AppInterviewBooking> {
    try {
      return await this.transaction(async (repository) => {
        const submission = await this.requireOpenSubmission(userId, repository);

        const slot = await repository.findBookableSlotById(interviewSlotId);
        if (slot === null) {
          throw new AppError("INTERVIEW_SLOT_NOT_FOUND", 404, "Interview slot not found");
        }

        const existing = await repository.findBookingForSubmission(submission.id);
        if (existing !== null && existing.interviewSlotId === interviewSlotId) {
          return existing;
        }

        const now = new Date();
        if (existing !== null) {
          if (!submission.interviewSlotSwitchingEnabled) {
            throw new AppError(
              "INTERVIEW_SLOT_SWITCHING_DISABLED",
              409,
              "Changing interview slots is turned off",
            );
          }
          if (new Date(existing.startTime) <= now) {
            throw new AppError("INTERVIEW_SLOT_LOCKED", 409, "Your current interview slot has already started");
          }
        }
        if (slot.startTime <= now) {
          throw new AppError("INTERVIEW_SLOT_CLOSED", 409, "This interview slot is not open for booking");
        }

        const reserved = await repository.tryReserveSeat(interviewSlotId, slot.capacity);
        if (!reserved) {
          throw new AppError("INTERVIEW_SLOT_FULL", 409, "Interview slot has no remaining capacity");
        }

        if (existing === null) {
          return repository.createBooking(submission.id, interviewSlotId);
        }

        const moved = await repository.moveBooking(submission.id, existing.interviewSlotId, interviewSlotId);
        if (moved === null) {
          // Lost a race with another switch; throwing rolls back the seat reserved above.
          throw new AppError("INTERVIEW_SLOT_ALREADY_BOOKED", 409, "Your booking changed; refresh and retry");
        }
        await repository.releaseSeat(existing.interviewSlotId);
        return moved;
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError("INTERVIEW_SLOT_ALREADY_BOOKED", 409, "An interview slot is already booked");
      }
      throw error;
    }
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

  /** Paid, undecided, and past the test — the gate for student interview booking. */
  private async requireOpenSubmission(userId: string, repository: InterviewSlotRepository = this.repository) {
    const submission = await repository.findActiveSubmissionForUser(userId);
    if (submission === null || submission.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
    if (submission.decision !== RecruitmentDecision.PENDING) {
      throw new AppError("RECRUITMENT_ALREADY_DECIDED", 409, "A decision has already been made");
    }
    if (submission.testResult !== TestResult.PASSED) {
      throw new AppError("INTERVIEW_BOOKING_NOT_OPEN", 403, "Interview booking opens after you pass the test");
    }
    return submission;
  }

  private async requireCycleExists(cycleId: string): Promise<void> {
    if (!(await this.repository.cycleExists(cycleId))) {
      throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
    }
  }
}
