import type { PaymentStatus } from "../../../generated/prisma/client.js";

// GET /app/interview-booking
export interface AppInterviewBooking {
  interviewSlotId: string;
  startTime: string;
  endTime: string;
  location: string | null;
  meetingUrl: string | null;
  bookedAt: string;
}

export interface ActiveSubmissionForInterview {
  id: string;
  paymentStatus: PaymentStatus;
}

export interface InterviewSlotForAssignment {
  id: string;
  capacity: number;
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
