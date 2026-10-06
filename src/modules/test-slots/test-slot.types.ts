import type { PaymentStatus, RecruitmentDecision, TestResult } from "../../../generated/prisma/client.js";

// Module 7 — GET /app/test-slot-booking
export interface AppTestSlotBooking {
  testSlotId: string;
  startTime: string;
  endTime: string;
  bookedAt: string;
}

// Module 7 — GET /app/test-slots
export interface AppTestSlot {
  testSlotId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  remaining: number;
  isMine: boolean;
}

export interface AppTestSlotList {
  slots: AppTestSlot[];
  switchingEnabled: boolean;
}

export interface ActiveSubmissionForBooking {
  id: string;
  paymentStatus: PaymentStatus;
  decision: RecruitmentDecision;
  testSlotSwitchingEnabled: boolean;
}

export interface TestSlotForBooking {
  id: string;
  capacity: number;
}

// Student booking also needs to know whether the slot is open to them.
export interface BookableTestSlot extends TestSlotForBooking {
  isVisible: boolean;
  startTime: Date;
}

export interface TestResultUpdate {
  registrationId: string;
  testResult: TestResult;
  testResultUpdatedAt: string;
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
  findBookableSlotById(testSlotId: string): Promise<BookableTestSlot | null>;
  listSlotsForStudent(submissionId: string, now: Date): Promise<AppTestSlot[]>;
  moveBooking(submissionId: string, fromSlotId: string, toSlotId: string): Promise<AppTestSlotBooking | null>;
  setTestResult(submissionId: string, result: TestResult): Promise<TestResultUpdate>;
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
