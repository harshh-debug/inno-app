import type { PaymentStatus, RecruitmentDecision, TestResult } from "../../../generated/prisma/client.js";

// GET /app/interview-booking
export interface AppInterviewBooking {
  interviewSlotId: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingUrl: string | null;
  bookedAt: string;
}

// GET /app/interview-slots — interviewerName is deliberately not exposed to students.
export interface AppInterviewSlot {
  interviewSlotId: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingUrl: string | null;
  capacity: number;
  remaining: number;
  isMine: boolean;
}

export interface AppInterviewSlotList {
  slots: AppInterviewSlot[];
  switchingEnabled: boolean;
}

export interface ActiveSubmissionForInterview {
  id: string;
  paymentStatus: PaymentStatus;
  decision: RecruitmentDecision;
  testResult: TestResult;
  interviewSlotSwitchingEnabled: boolean;
}

export interface InterviewSlotForAssignment {
  id: string;
  capacity: number;
}

export interface BookableInterviewSlot extends InterviewSlotForAssignment {
  startTime: Date;
}

// Admin views expose the full row — capacity/interviewer/location are all
// admin-managed, and bookedCount lets the panel show remaining seats.
export interface AdminInterviewSlot {
  id: string;
  recruitmentCycleId: string;
  interviewerName: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingUrl: string | null;
  capacity: number;
  isCancelled: boolean;
  bookedCount: number;
  remainingSeats: number;
}

export interface AdminInterviewSlotDetail {
  id: string;
  recruitmentCycleId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  bookedCount: number;
}

export interface CreateInterviewSlotInput {
  interviewerName: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  meetingUrl?: string;
  capacity: number;
  isCancelled: boolean;
}

export interface UpdateInterviewSlotInput {
  interviewerName?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
  isCancelled?: boolean;
}

// Applicant identity for the admin "who's assigned to this slot" view — same
// fields the admin registration listing already exposes.
export interface AdminInterviewBookingRow {
  applicationNumber: number;
  collegeEmail: string;
  fullName: string | null;
  bookedAt: string;
}

export interface InterviewSlotRepository {
  findActiveSubmissionForUser(userId: string): Promise<ActiveSubmissionForInterview | null>;
  findBookingForSubmission(submissionId: string): Promise<AppInterviewBooking | null>;
  findSlotById(interviewSlotId: string): Promise<InterviewSlotForAssignment | null>;
  findBookableSlotById(interviewSlotId: string): Promise<BookableInterviewSlot | null>;
  listSlotsForStudent(submissionId: string, now: Date): Promise<AppInterviewSlot[]>;
  moveBooking(submissionId: string, fromSlotId: string, toSlotId: string): Promise<AppInterviewBooking | null>;
  tryReserveSeat(interviewSlotId: string, capacity: number): Promise<boolean>;
  releaseSeat(interviewSlotId: string): Promise<void>;
  createBooking(submissionId: string, interviewSlotId: string): Promise<AppInterviewBooking>;
  reassignBooking(submissionId: string, interviewSlotId: string): Promise<AppInterviewBooking>;

  submissionExists(submissionId: string): Promise<boolean>;
  cycleExists(cycleId: string): Promise<boolean>;
  listForCycle(cycleId: string): Promise<AdminInterviewSlot[]>;
  findDetailById(interviewSlotId: string): Promise<AdminInterviewSlotDetail | null>;
  createSlotForCycle(cycleId: string, input: CreateInterviewSlotInput): Promise<AdminInterviewSlot>;
  updateSlot(interviewSlotId: string, input: UpdateInterviewSlotInput): Promise<AdminInterviewSlot>;
  listBookingsForSlot(interviewSlotId: string): Promise<AdminInterviewBookingRow[]>;
}
