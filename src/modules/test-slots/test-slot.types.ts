import type { PaymentStatus } from "../../../generated/prisma/client.js";

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
}

export interface TestSlotForBooking {
  id: string;
  capacity: number;
}

// Admin views expose the full row — capacity/order/visibility are all
// admin-managed, and bookedCount lets the panel show remaining seats.
export interface AdminTestSlot {
  id: string;
  recruitmentCycleId: string;
  startTime: string;
  endTime: string;
  order: number;
  isVisible: boolean;
  capacity: number;
  bookedCount: number;
  remainingSeats: number;
}

export interface AdminTestSlotDetail {
  id: string;
  recruitmentCycleId: string;
  startTime: Date;
  endTime: Date;
  order: number;
  isVisible: boolean;
  capacity: number;
  bookedCount: number;
}

export interface CreateTestSlotInput {
  startTime: Date;
  endTime: Date;
  isVisible: boolean;
  capacity: number;
}

export interface UpdateTestSlotInput {
  startTime?: Date;
  endTime?: Date;
  isVisible?: boolean;
  capacity?: number;
}

// Applicant identity for the admin "who booked this slot" view — same fields
// the admin registration listing already exposes (no internal IDs beyond
// the application number).
export interface AdminTestSlotBookingRow {
  applicationNumber: number;
  collegeEmail: string;
  fullName: string | null;
  bookedAt: string;
}

export interface TestSlotRepository {
  findActiveSubmissionForUser(userId: string): Promise<ActiveSubmissionForBooking | null>;
  findBookingForSubmission(submissionId: string): Promise<AppTestSlotBooking | null>;
  findSlotById(testSlotId: string): Promise<TestSlotForBooking | null>;
  tryReserveSeat(testSlotId: string, capacity: number): Promise<boolean>;
  releaseSeat(testSlotId: string): Promise<void>;
  createBooking(submissionId: string, testSlotId: string): Promise<AppTestSlotBooking>;

  submissionExists(submissionId: string): Promise<boolean>;
  reassignBooking(submissionId: string, testSlotId: string): Promise<AppTestSlotBooking>;

  cycleExists(cycleId: string): Promise<boolean>;
  listForCycle(cycleId: string): Promise<AdminTestSlot[]>;
  findDetailById(testSlotId: string): Promise<AdminTestSlotDetail | null>;
  createSlotForCycle(cycleId: string, input: CreateTestSlotInput): Promise<AdminTestSlot>;
  updateSlot(testSlotId: string, input: UpdateTestSlotInput): Promise<AdminTestSlot>;
  setSlotOrder(testSlotId: string, order: number): Promise<void>;
  listBookingsForSlot(testSlotId: string): Promise<AdminTestSlotBookingRow[]>;
}
