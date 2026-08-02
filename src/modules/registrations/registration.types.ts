import type {
  FormInputSubmission,
  PaymentStatus,
  RecruitmentDecision,
  RegistrationSubmission,
  User,
} from "../../../generated/prisma/client.js";

export interface SubmitRegistrationAnswerInput {
  fieldId: string;
  value: unknown;
}

export interface SubmitRegistrationInput {
  studentDetails: {
    collegeEmail: string;
    personalEmail?: string | null;
    fullName?: string | null;
    phone?: string | null;
    batch?: string | null;
    year?: number | null;
  };
  answers: SubmitRegistrationAnswerInput[];
}

export interface RegistrationSearchFilters {
  recruitmentCycleId: string;
  name?: string;
  email?: string;
  applicationNumber?: number;
  paymentStatus?: PaymentStatus;
  decision?: RecruitmentDecision;
  page: number;
  pageSize: number;
}

export interface RegistrationSearchResult {
  items: Array<RegistrationSubmission & { user: User }>;
  total: number;
  page: number;
  pageSize: number;
}

export type RegistrationDetail = RegistrationSubmission & {
  user: User;
  formInputs: FormInputSubmission[];
  testSlotBooking: { testSlotId: string; bookedAt: Date } | null;
  decidedBy: User | null;
};

export interface CreateFormInputSubmissionRow {
  submissionId: string;
  fieldId: string;
  fieldKey: string;
  fieldTitle: string;
  fieldType: FormInputSubmission["fieldType"];
  value: string;
}

export interface RegistrationRepository {
  findByUserAndCycle(userId: string, recruitmentCycleId: string): Promise<RegistrationSubmission | null>;
  createRegistration(input: {
    userId: string;
    recruitmentCycleId: string;
    formId: string;
  }): Promise<RegistrationSubmission>;
  createFormInputs(rows: CreateFormInputSubmissionRow[]): Promise<void>;
  findById(id: string): Promise<RegistrationDetail | null>;
  search(filters: RegistrationSearchFilters): Promise<RegistrationSearchResult>;
  updatePaymentStatus(id: string, status: PaymentStatus, updatedAt: Date): Promise<RegistrationSubmission>;
  transitionPaymentStatus(
    id: string,
    from: PaymentStatus,
    to: PaymentStatus,
    updatedAt: Date,
  ): Promise<RegistrationSubmission | null>;
  updateDecision(
    id: string,
    input: {
      decision: RecruitmentDecision;
      decisionNote: string | null;
      decidedAt: Date | null;
      decidedById: string | null;
    },
  ): Promise<RegistrationSubmission>;
  updateFinalDecisionForPaid(
    id: string,
    input: {
      decision: RecruitmentDecision;
      decisionNote: string | null;
      decidedAt: Date;
      decidedById: string;
    },
  ): Promise<RegistrationSubmission | null>;
}
