import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import { PaymentStatus } from "../../../generated/prisma/client.js";
import type { ActiveSubmissionForBooking, AppTestSlot, AppTestSlotBooking, TestSlotRepository } from "./test-slot.types.js";

type TransactionRunner = <T>(operation: (repository: TestSlotRepository) => Promise<T>) => Promise<T>;

/** Module 7 — student-facing test-slot listing and booking (PRD §16). */
export class TestSlotService {
  constructor(
    private readonly repository: TestSlotRepository,
    private readonly transaction: TransactionRunner,
  ) {}

  async listAvailableSlots(userId: string): Promise<AppTestSlot[]> {
    await this.requirePaidActiveSubmission(userId);
    return this.repository.listVisibleSlotsForActiveCycle();
  }

  async getMyBooking(userId: string): Promise<AppTestSlotBooking> {
    const submission = await this.requirePaidActiveSubmission(userId);
    const booking = await this.repository.findBookingForSubmission(submission.id);
    if (booking === null) {
      throw new AppError("TEST_SLOT_NOT_BOOKED", 404, "No test slot booked yet");
    }
    return booking;
  }

  async bookSlot(userId: string, testSlotId: string): Promise<AppTestSlotBooking> {
    try {
      return await this.transaction(async (repository) => {
        const submission = await this.requirePaidActiveSubmission(userId, repository);

        if (submission.bookedTestSlotId !== null) {
          throw new AppError("TEST_SLOT_ALREADY_BOOKED", 409, "A test slot is already booked");
        }

        const slot = await repository.findSlotById(testSlotId);
        if (slot === null) {
          throw new AppError("TEST_SLOT_NOT_FOUND", 404, "Test slot not found");
        }

        const reserved = await repository.tryReserveSeat(testSlotId, slot.capacity);
        if (!reserved) {
          throw new AppError("TEST_SLOT_FULL", 409, "Test slot has no remaining capacity");
        }

        try {
          return await repository.createBooking(submission.id, testSlotId);
        } catch (error) {
          await repository.releaseSeat(testSlotId);
          throw error;
        }
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError("TEST_SLOT_ALREADY_BOOKED", 409, "A test slot is already booked");
      }
      throw error;
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
