import {
  PaymentStatus,
  RecruitmentDecision,
  type FormField,
  type InputType,
  type RegistrationSubmission,
  type User,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import type { UserService } from "../users/user.service.js";
import { deriveAccountState } from "../users/account-state.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { RecruitmentCycleService } from "../recruitment-cycles/recruitment-cycle.service.js";
import { validateAndNormalizeAnswer } from "./form/answer-validation.js";
import type { FormService } from "./form/form.service.js";
import type {
  RegistrationDetail,
  RegistrationRepository,
  SubmitRegistrationInput,
} from "./registration.types.js";

export interface SubmitRegistrationResult {
  registrationId: string;
  applicationNumber: number;
  paymentStatus: PaymentStatus;
}

export interface PaymentStatusUpdateResult {
  registration: RegistrationSubmission;
  emailQueued: boolean;
}

interface AdminApplicantView {
  id: string;
  collegeEmail: string;
  personalEmail: string | null;
  fullName: string | null;
  phone: string | null;
  batch: string | null;
  year: number | null;
  isSuspended: boolean;
  accountState: ReturnType<typeof deriveAccountState>;
}

export interface RegistrationDetailView {
  registration: Omit<RegistrationDetail, "formInputs" | "user" | "decidedBy" | "testSlotBooking" | "userId" | "recruitmentCycleId" | "formId" | "decidedById">;
  applicant: AdminApplicantView;
  decisionActor: { id: string; fullName: string | null; collegeEmail: string } | null;
  selectedTestSlot: RegistrationDetail["testSlotBooking"];
  answers: Array<{ fieldId: string; fieldKey: string; fieldTitle: string; fieldType: InputType; value: string }>;
  currentFormAnswers: Array<{
    fieldId: string;
    fieldKey: string;
    fieldTitle: string;
    fieldType: InputType;
    value: string | null;
  }>;
}

interface TransactionContext {
  registrationRepository: RegistrationRepository;
  userService: UserService;
  recruitmentCycleService: RecruitmentCycleService;
  formService: FormService;
}

/**
 * Owns public registration submission and admin registration operations
 * (search, payment transitions, decisions) per PRD §7.1, §7.2, §7.3, §20.2,
 * §20.3, §20.6.
 */
export class RegistrationService {
  constructor(
    private readonly registrationRepository: RegistrationRepository,
    private readonly recruitmentCycleService: RecruitmentCycleService,
    private readonly formService: FormService,
    private readonly notificationService: NotificationService,
    private readonly transaction: <T>(operation: (context: TransactionContext) => Promise<T>) => Promise<T>,
  ) {}

  async submitPublicRegistration(input: SubmitRegistrationInput): Promise<SubmitRegistrationResult> {
    try {
      return await this.transaction(async ({
        registrationRepository,
        userService,
        recruitmentCycleService,
        formService,
      }) => {
        const cycle = await recruitmentCycleService.getActiveCycleOrThrow();
        const { form, fields } = await formService.getActiveFieldsForCycle(cycle.id);
        const fieldsById = new Map<string, FormField>(fields.map((field) => [field.id, field]));
        const seenFieldIds = new Set<string>();
        const rows: Array<{
          fieldId: string;
          fieldKey: string;
          fieldTitle: string;
          fieldType: InputType;
          value: string;
        }> = [];

        for (const answer of input.answers) {
          if (seenFieldIds.has(answer.fieldId)) {
            throw new AppError(
              "DUPLICATE_FORM_ANSWER",
              400,
              `More than one answer was submitted for the same field (${answer.fieldId})`,
            );
          }
          seenFieldIds.add(answer.fieldId);

          const field = fieldsById.get(answer.fieldId);
          if (field === undefined) {
            throw new AppError(
              "UNKNOWN_FORM_FIELD",
              400,
              `Field ${answer.fieldId} is not part of the active registration form`,
            );
          }

          const normalizedValue = validateAndNormalizeAnswer(field, answer.value);
          if (normalizedValue !== undefined) {
            rows.push({
              fieldId: field.id,
              fieldKey: field.key,
              fieldTitle: field.title,
              fieldType: field.type,
              value: normalizedValue,
            });
          }
        }

        for (const field of fields) {
          if (field.required && !seenFieldIds.has(field.id)) {
            throw new AppError("VALIDATION_ERROR", 400, `${field.title} is required`);
          }
        }

        const { user } = await userService.findOrCreateProvisionalStudent(input.studentDetails);

        const existingRegistration = await registrationRepository.findByUserAndCycle(user.id, cycle.id);
        if (existingRegistration !== null) {
          throw this.duplicateRegistrationError();
        }

        const registration = await registrationRepository.createRegistration({
          userId: user.id,
          recruitmentCycleId: cycle.id,
          formId: form.id,
        });

        await registrationRepository.createFormInputs(
          rows.map((row) => ({ submissionId: registration.id, ...row })),
        );

        return {
          registrationId: registration.id,
          applicationNumber: registration.applicationNumber,
          paymentStatus: registration.paymentStatus,
        };
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw this.duplicateRegistrationError();
      }
      throw error;
    }
  }

  async listForAdmin(
    recruitmentCycleId: string,
    filters: {
      name?: string;
      email?: string;
      applicationNumber?: number;
      paymentStatus?: PaymentStatus;
      decision?: RecruitmentDecision;
      page: number;
      pageSize: number;
    },
  ) {
    await this.recruitmentCycleService.getById(recruitmentCycleId);
    const result = await this.registrationRepository.search({ recruitmentCycleId, ...filters });
    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        applicationNumber: item.applicationNumber,
        paymentStatus: item.paymentStatus,
        paymentStatusUpdatedAt: item.paymentStatusUpdatedAt,
        decision: item.decision,
        decisionNote: item.decisionNote,
        submittedAt: item.submittedAt,
        updatedAt: item.updatedAt,
        applicant: this.toApplicantView(item.user),
      })),
    };
  }

  async getDetailForAdmin(registrationId: string): Promise<RegistrationDetailView> {
    const registration = await this.findByIdOrThrow(registrationId);

    let activeFields: FormField[] = [];
    try {
      const active = await this.formService.getActiveFieldsForCycle(registration.recruitmentCycleId);
      activeFields = active.fields;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "FORM_NOT_FOUND") {
        throw error;
      }
    }

    const historicalByFieldId = new Map(registration.formInputs.map((input) => [input.fieldId, input]));

    const answers = registration.formInputs.map((input) => ({
      fieldId: input.fieldId,
      fieldKey: input.fieldKey,
      fieldTitle: input.fieldTitle,
      fieldType: input.fieldType,
      value: input.value,
    }));

    const currentFormAnswers = activeFields.map((field) => {
      const historical = historicalByFieldId.get(field.id);
      return {
        fieldId: field.id,
        fieldKey: field.key,
        fieldTitle: field.title,
        fieldType: field.type,
        value: historical?.value ?? null,
      };
    });

    const {
      formInputs: _formInputs,
      user,
      decidedBy,
      testSlotBooking,
      userId: _userId,
      recruitmentCycleId: _recruitmentCycleId,
      formId: _formId,
      decidedById: _decidedById,
      ...registrationWithoutInternals
    } = registration;

    return {
      registration: registrationWithoutInternals,
      applicant: this.toApplicantView(user),
      decisionActor:
        decidedBy === null
          ? null
          : { id: decidedBy.id, fullName: decidedBy.fullName, collegeEmail: decidedBy.collegeEmail },
      selectedTestSlot: testSlotBooking,
      answers,
      currentFormAnswers,
    };
  }

  /**
   * Applies the PRD §7.2/§7.3 payment-transition table. Same-status requests
   * make no change and send no email. A real UNPAID->PAID transition always
   * queues REGISTRATION_SUCCESS; if enqueueing fails, the payment update is
   * kept and `emailQueued: false` is returned so an admin can retry via
   * PAID -> UNPAID -> PAID.
   */
  async updatePaymentStatus(
    registrationId: string,
    requestedStatus: PaymentStatus,
  ): Promise<PaymentStatusUpdateResult> {
    const registration = await this.findByIdOrThrow(registrationId);

    if (registration.paymentStatus === requestedStatus) {
      return { registration, emailQueued: false };
    }

    const updated = await this.registrationRepository.transitionPaymentStatus(
      registrationId,
      registration.paymentStatus,
      requestedStatus,
      new Date(),
    );

    if (updated === null) {
      const current = await this.findByIdOrThrow(registrationId);
      return { registration: current, emailQueued: false };
    }

    if (requestedStatus !== PaymentStatus.PAID) {
      return { registration: updated, emailQueued: false };
    }

    try {
      await this.notificationService.queueRegistrationSuccess(registration.user.collegeEmail);
      return { registration: updated, emailQueued: true };
    } catch {
      return { registration: updated, emailQueued: false };
    }
  }

  /** Only paid registrations may receive a decision other than PENDING (PRD §20.6). */
  async updateDecision(
    registrationId: string,
    input: { decision: RecruitmentDecision; decisionNote?: string | null },
    actorId: string,
  ) {
    const registration = await this.findByIdOrThrow(registrationId);

    if (input.decision === RecruitmentDecision.PENDING) {
      return this.registrationRepository.updateDecision(registrationId, {
        decision: RecruitmentDecision.PENDING,
        decisionNote: null,
        decidedAt: null,
        decidedById: null,
      });
    }

    if (registration.paymentStatus !== PaymentStatus.PAID) {
      throw new AppError(
        "DECISION_REQUIRES_PAID_REGISTRATION",
        409,
        "Only paid registrations may receive a final decision",
      );
    }

    const updated = await this.registrationRepository.updateFinalDecisionForPaid(registrationId, {
      decision: input.decision,
      decisionNote: input.decisionNote ?? null,
      decidedAt: new Date(),
      decidedById: actorId,
    });
    if (updated === null) {
      throw new AppError(
        "DECISION_REQUIRES_PAID_REGISTRATION",
        409,
        "Only paid registrations may receive a final decision",
      );
    }
    return updated;
  }

  private async findByIdOrThrow(registrationId: string): Promise<RegistrationDetail> {
    const registration = await this.registrationRepository.findById(registrationId);
    if (registration === null) {
      throw new AppError("REGISTRATION_NOT_FOUND", 404, "Registration not found");
    }
    return registration;
  }

  private duplicateRegistrationError(): AppError {
    return new AppError(
      "DUPLICATE_REGISTRATION",
      409,
      "This email has already registered for the active recruitment cycle",
    );
  }

  private toApplicantView(user: User): AdminApplicantView {
    return {
      id: user.id,
      collegeEmail: user.collegeEmail,
      personalEmail: user.personalEmail,
      fullName: user.fullName,
      phone: user.phone,
      batch: user.batch,
      year: user.year,
      isSuspended: user.isSuspended,
      accountState: deriveAccountState(user),
    };
  }
}
