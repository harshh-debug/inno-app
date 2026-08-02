import {
  PaymentStatus,
  type Prisma,
  type PrismaClient,
  type RecruitmentDecision,
  type RegistrationSubmission,
} from "../../../generated/prisma/client.js";
import type {
  CreateFormInputSubmissionRow,
  RegistrationDetail,
  RegistrationRepository,
  RegistrationSearchFilters,
  RegistrationSearchResult,
} from "./registration.types.js";

type RegistrationDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for registrations, their answers, payment, and decisions. */
export class PrismaRegistrationRepository implements RegistrationRepository {
  constructor(private readonly prisma: RegistrationDatabaseClient) {}

  findByUserAndCycle = (
    userId: string,
    recruitmentCycleId: string,
  ): Promise<RegistrationSubmission | null> => {
    return this.prisma.registrationSubmission.findUnique({
      where: { userId_recruitmentCycleId: { userId, recruitmentCycleId } },
    });
  };

  createRegistration = (input: {
    userId: string;
    recruitmentCycleId: string;
    formId: string;
  }): Promise<RegistrationSubmission> => {
    return this.prisma.registrationSubmission.create({ data: input });
  };

  createFormInputs = async (rows: CreateFormInputSubmissionRow[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    await this.prisma.formInputSubmission.createMany({ data: rows });
  };

  findById = (id: string): Promise<RegistrationDetail | null> => {
    return this.prisma.registrationSubmission.findUnique({
      where: { id },
      include: {
        user: true,
        decidedBy: true,
        formInputs: true,
        testSlotBooking: { select: { testSlotId: true, bookedAt: true } },
      },
    }) as unknown as Promise<RegistrationDetail | null>;
  };

  search = async (filters: RegistrationSearchFilters): Promise<RegistrationSearchResult> => {
    const where: Prisma.RegistrationSubmissionWhereInput = {
      recruitmentCycleId: filters.recruitmentCycleId,
      ...(filters.paymentStatus !== undefined ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.decision !== undefined ? { decision: filters.decision } : {}),
      ...(filters.applicationNumber !== undefined
        ? { applicationNumber: filters.applicationNumber }
        : {}),
      ...(filters.name !== undefined
        ? { user: { fullName: { contains: filters.name, mode: "insensitive" } } }
        : {}),
      ...(filters.email !== undefined
        ? { user: { collegeEmail: { contains: filters.email, mode: "insensitive" } } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.registrationSubmission.findMany({
        where,
        include: { user: true },
        orderBy: { submittedAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.registrationSubmission.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  };

  updatePaymentStatus = (
    id: string,
    status: PaymentStatus,
    updatedAt: Date,
  ): Promise<RegistrationSubmission> => {
    return this.prisma.registrationSubmission.update({
      where: { id },
      data: { paymentStatus: status, paymentStatusUpdatedAt: updatedAt },
    });
  };

  async transitionPaymentStatus(
    id: string,
    from: PaymentStatus,
    to: PaymentStatus,
    updatedAt: Date,
  ): Promise<RegistrationSubmission | null> {
    const changed = await this.prisma.registrationSubmission.updateMany({
      where: { id, paymentStatus: from },
      data: { paymentStatus: to, paymentStatusUpdatedAt: updatedAt },
    });
    if (changed.count !== 1) {
      return null;
    }
    return this.prisma.registrationSubmission.findUnique({ where: { id } });
  }

  updateDecision = (
    id: string,
    input: {
      decision: RecruitmentDecision;
      decisionNote: string | null;
      decidedAt: Date | null;
      decidedById: string | null;
    },
  ): Promise<RegistrationSubmission> => {
    return this.prisma.registrationSubmission.update({ where: { id }, data: input });
  };

  async updateFinalDecisionForPaid(
    id: string,
    input: {
      decision: RecruitmentDecision;
      decisionNote: string | null;
      decidedAt: Date;
      decidedById: string;
    },
  ): Promise<RegistrationSubmission | null> {
    const changed = await this.prisma.registrationSubmission.updateMany({
      where: { id, paymentStatus: PaymentStatus.PAID },
      data: input,
    });
    if (changed.count !== 1) {
      return null;
    }
    return this.prisma.registrationSubmission.findUnique({ where: { id } });
  }
}
