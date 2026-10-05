import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import { PaymentStatus, RecruitmentDecision, type TestResult } from "../../../generated/prisma/client.js";
import type {
  ActiveSubmissionForBooking,
  AdminTestSlot,
  AdminTestSlotBookingRow,
  AppTestSlotBooking,
  AppTestSlotList,
  CreateTestSlotInput,
  TestResultUpdate,
  TestSlotRepository,
  UpdateTestSlotInput,
} from "./test-slot.types.js";

type TransactionRunner = <T>(operation: (repository: TestSlotRepository) => Promise<T>) => Promise<T>;

/**
 * Module 7 — test-slot scheduling. Students book or switch their own slot
 * (first-come-first-serve); admins can still assign/override regardless of
 * the cycle's switching flag.
 */
export class TestSlotService {
  constructor(
    private readonly repository: TestSlotRepository,
    private readonly transaction: TransactionRunner,
  ) {}

  async getMyBooking(userId: string): Promise<AppTestSlotBooking> {
    const submission = await this.requirePaidActiveSubmission(userId);
    const booking = await this.repository.findBookingForSubmission(submission.id);
    if (booking === null) {
      throw new AppError("TEST_SLOT_NOT_BOOKED", 404, "No test slot booked yet");
    }
    return booking;
  }

  async listSlotsForStudent(userId: string): Promise<AppTestSlotList> {
    const submission = await this.requirePaidActiveSubmission(userId);
    const slots = await this.repository.listSlotsForStudent(submission.id, new Date());
    return { slots, switchingEnabled: submission.testSlotSwitchingEnabled };
  }

  /**
   * Student books their first slot or moves to another. The new seat is
   * reserved before the old one is released, all in one transaction, so a
   * full target slot leaves the existing booking untouched.
   */
  async bookSlot(userId: string, testSlotId: string): Promise<AppTestSlotBooking> {
    try {
      return await this.transaction(async (repository) => {
        const submission = await this.requirePaidActiveSubmission(userId, repository);
        if (submission.decision !== RecruitmentDecision.PENDING) {
          throw new AppError("RECRUITMENT_ALREADY_DECIDED", 409, "A decision has already been made");
        }

        const slot = await repository.findBookableSlotById(testSlotId);
        if (slot === null) {
          throw new AppError("TEST_SLOT_NOT_FOUND", 404, "Test slot not found");
        }

        const existing = await repository.findBookingForSubmission(submission.id);
        if (existing !== null && existing.testSlotId === testSlotId) {
          return existing;
        }

        const now = new Date();
        if (existing !== null) {
          if (!submission.testSlotSwitchingEnabled) {
            throw new AppError("TEST_SLOT_SWITCHING_DISABLED", 409, "Changing test slots is turned off");
          }
          if (new Date(existing.startTime) <= now) {
            throw new AppError("TEST_SLOT_LOCKED", 409, "Your current test slot has already started");
          }
        }
        if (!slot.isVisible || slot.startTime <= now) {
          throw new AppError("TEST_SLOT_CLOSED", 409, "This test slot is not open for booking");
        }

        const reserved = await repository.tryReserveSeat(testSlotId, slot.capacity);
        if (!reserved) {
          throw new AppError("TEST_SLOT_FULL", 409, "Test slot has no remaining capacity");
        }

        if (existing === null) {
          return repository.createBooking(submission.id, testSlotId);
        }

        const moved = await repository.moveBooking(submission.id, existing.testSlotId, testSlotId);
        if (moved === null) {
          // Lost a race with another switch; throwing rolls back the seat reserved above.
          throw new AppError("TEST_SLOT_ALREADY_BOOKED", 409, "Your booking changed; refresh and retry");
        }
        await repository.releaseSeat(existing.testSlotId);
        return moved;
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError("TEST_SLOT_ALREADY_BOOKED", 409, "A test slot is already booked");
      }
      throw error;
    }
  }

  async setTestResult(submissionId: string, result: TestResult): Promise<TestResultUpdate> {
    if (!(await this.repository.submissionExists(submissionId))) {
      throw new AppError("REGISTRATION_SUBMISSION_NOT_FOUND", 404, "Registration submission not found");
    }
    return this.repository.setTestResult(submissionId, result);
  }

  /**
   * Admin assigns (or reassigns) a submission to a slot. Reserves the new
   * seat before touching any existing booking, so a full slot fails before
   * anything changes; the whole thing runs in one transaction, so a failure
   * partway through rolls back cleanly with no manual compensation needed.
   */
  async assignSlot(submissionId: string, testSlotId: string): Promise<AppTestSlotBooking> {
    return this.transaction(async (repository) => {
      if (!(await repository.submissionExists(submissionId))) {
        throw new AppError("REGISTRATION_SUBMISSION_NOT_FOUND", 404, "Registration submission not found");
      }

      const slot = await repository.findSlotById(testSlotId);
      if (slot === null) {
        throw new AppError("TEST_SLOT_NOT_FOUND", 404, "Test slot not found");
      }

      const existingBooking = await repository.findBookingForSubmission(submissionId);
      if (existingBooking !== null && existingBooking.testSlotId === testSlotId) {
        return existingBooking;
      }

      const reserved = await repository.tryReserveSeat(testSlotId, slot.capacity);
      if (!reserved) {
        throw new AppError("TEST_SLOT_FULL", 409, "Test slot has no remaining capacity");
      }

      if (existingBooking !== null) {
        await repository.releaseSeat(existingBooking.testSlotId);
        return repository.reassignBooking(submissionId, testSlotId);
      }

      return repository.createBooking(submissionId, testSlotId);
    });
  }

  async listSlotsForCycle(cycleId: string): Promise<AdminTestSlot[]> {
    await this.requireCycleExists(cycleId);
    return this.repository.listForCycle(cycleId);
  }

  async createSlot(cycleId: string, input: CreateTestSlotInput): Promise<AdminTestSlot> {
    return this.transaction(async (repository) => {
      if (!(await repository.cycleExists(cycleId))) {
        throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
      }
      return repository.createSlotForCycle(cycleId, input);
    });
  }

  /**
   * `confirmTimeChange` mirrors the PRD's "editing a booked slot's date/time
   * requires explicit admin confirmation" — the admin panel must re-submit
   * with confirmation set once it has warned about existing bookings.
   */
  async updateSlot(
    testSlotId: string,
    input: UpdateTestSlotInput,
    confirmTimeChange: boolean,
  ): Promise<AdminTestSlot> {
    return this.transaction(async (repository) => {
      const slot = await repository.findDetailById(testSlotId);
      if (slot === null) {
        throw new AppError("TEST_SLOT_NOT_FOUND", 404, "Test slot not found");
      }

      if (input.capacity !== undefined && input.capacity < slot.bookedCount) {
        throw new AppError(
          "TEST_SLOT_CAPACITY_BELOW_BOOKINGS",
          400,
          `Capacity cannot be reduced below the ${slot.bookedCount} existing booking(s)`,
        );
      }

      const changesTime =
        (input.startTime !== undefined && input.startTime.getTime() !== slot.startTime.getTime()) ||
        (input.endTime !== undefined && input.endTime.getTime() !== slot.endTime.getTime());
      if (changesTime && slot.bookedCount > 0 && !confirmTimeChange) {
        throw new AppError(
          "TEST_SLOT_TIME_CHANGE_REQUIRES_CONFIRMATION",
          409,
          `This slot has ${slot.bookedCount} existing booking(s); resubmit with confirmTimeChange: true to change its time`,
        );
      }

      return repository.updateSlot(testSlotId, input);
    });
  }

  /** Two-phase reorder (negative offsets, then final values) — see FormService.reorderFields. */
  async reorderSlots(cycleId: string, orderedSlotIds: string[]): Promise<AdminTestSlot[]> {
    return this.transaction(async (repository) => {
      const existingSlots = await repository.listForCycle(cycleId);
      const requestedIds = new Set(orderedSlotIds);

      if (
        orderedSlotIds.length !== existingSlots.length ||
        requestedIds.size !== orderedSlotIds.length ||
        existingSlots.some((slot) => !requestedIds.has(slot.id))
      ) {
        throw new AppError(
          "INVALID_TEST_SLOT_ORDER",
          400,
          "The reorder request must include every existing test slot for this cycle exactly once",
        );
      }

      for (const [index, slotId] of orderedSlotIds.entries()) {
        await repository.setSlotOrder(slotId, -(index + 1));
      }
      for (const [index, slotId] of orderedSlotIds.entries()) {
        await repository.setSlotOrder(slotId, index);
      }

      return repository.listForCycle(cycleId);
    });
  }

  async listBookings(testSlotId: string): Promise<AdminTestSlotBookingRow[]> {
    const slot = await this.repository.findDetailById(testSlotId);
    if (slot === null) {
      throw new AppError("TEST_SLOT_NOT_FOUND", 404, "Test slot not found");
    }
    return this.repository.listBookingsForSlot(testSlotId);
  }

  private async requireCycleExists(cycleId: string): Promise<void> {
    if (!(await this.repository.cycleExists(cycleId))) {
      throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
    }
  }

  private async requirePaidActiveSubmission(
    userId: string,
    repository: TestSlotRepository = this.repository,
  ): Promise<ActiveSubmissionForBooking> {
    const submission = await repository.findActiveSubmissionForUser(userId);
    // requireAppStudent already confirmed a paid active-cycle registration
    // exists, so reaching either branch below means a race with that check
    // (e.g. an admin flipped payment/cycle state in between).
    if (submission === null) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
    if (submission.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
    return submission;
  }
}
