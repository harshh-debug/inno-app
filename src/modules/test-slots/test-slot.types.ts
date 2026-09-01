import type { PaymentStatus } from "../../../generated/prisma/client.js";

// Module 7 — GET /app/test-slots. Capacity/bookedCount stay server-side;
// students only need to know whether a slot is still bookable.
export interface AppTestSlot {
  id: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

// Module 7 — GET /app/test-slot-booking
export interface AppTestSlotBooking {
  testSlotId: string;
  startTime: string;
  endTime: string;
  bookedAt: string;
}

export interface ActiveSubmissionForBooking {
  id: string;
  paymentStatus: PaymentStatus;
  bookedTestSlotId: string | null;
}

export interface TestSlotForBooking {
  id: string;
  capacity: number;
}

export interface TestSlotRepository {
  findActiveSubmissionForUser(userId: string): Promise<ActiveSubmissionForBooking | null>;
  listVisibleSlotsForActiveCycle(): Promise<AppTestSlot[]>;
  findBookingForSubmission(submissionId: string): Promise<AppTestSlotBooking | null>;
  findSlotById(testSlotId: string): Promise<TestSlotForBooking | null>;
  tryReserveSeat(testSlotId: string, capacity: number): Promise<boolean>;
  releaseSeat(testSlotId: string): Promise<void>;
  createBooking(submissionId: string, testSlotId: string): Promise<AppTestSlotBooking>;
}
