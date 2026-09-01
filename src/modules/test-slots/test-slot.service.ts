import { AppError } from "../../common/errors.js";
import { PaymentStatus } from "../../../generated/prisma/client.js";
import type {
  ActiveSubmissionForBooking,
  AdminTestSlot,
  AdminTestSlotBookingRow,
  AppTestSlotBooking,
  CreateTestSlotInput,
  TestSlotRepository,
  UpdateTestSlotInput,
} from "./test-slot.types.js";

type TransactionRunner = <T>(operation: (repository: TestSlotRepository) => Promise<T>) => Promise<T>;

/**
 * Module 7 — test-slot scheduling. Admin assigns a submission to a slot;
 * the student only ever reads their own assignment (no self-booking).
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

  private async requirePaidActiveSubmission(userId: string): Promise<ActiveSubmissionForBooking> {
    const submission = await this.repository.findActiveSubmissionForUser(userId);
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
