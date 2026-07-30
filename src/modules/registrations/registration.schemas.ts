import { z } from "zod";
import { PaymentStatus, RecruitmentDecision } from "../../../generated/prisma/client.js";

const cycleIdParams = z.object({ cycleId: z.uuid() });
const registrationIdParams = z.object({ registrationId: z.uuid() });

const answerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]);

export const submitRegistrationSchema = z.object({
  body: z.object({
    studentDetails: z.object({
      collegeEmail: z.email().max(320),
      personalEmail: z.email().max(320).nullable().optional(),
      fullName: z.string().trim().max(200).nullable().optional(),
      phone: z.string().trim().max(40).nullable().optional(),
      batch: z.string().trim().max(100).nullable().optional(),
      year: z.number().int().nullable().optional(),
    }),
    answers: z
      .array(z.object({ fieldId: z.uuid(), value: answerValue.optional() }))
      .default([]),
  }),
});

export const listRegistrationsQuerySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().min(1).max(320).optional(),
  applicationNumber: z.coerce.number().int().positive().optional(),
  paymentStatus: z.enum(PaymentStatus).optional(),
  decision: z.enum(RecruitmentDecision).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listRegistrationsSchema = z.object({
  params: cycleIdParams,
  query: listRegistrationsQuerySchema,
});

export const getRegistrationSchema = z.object({ params: registrationIdParams });

export const updatePaymentStatusSchema = z.object({
  params: registrationIdParams,
  body: z.object({ paymentStatus: z.enum(PaymentStatus) }),
});

export const updateDecisionSchema = z.object({
  params: registrationIdParams,
  body: z.object({
    decision: z.enum(RecruitmentDecision),
    decisionNote: z.string().trim().max(2000).nullable().optional(),
  }),
});

export type SubmitRegistrationRequest = z.infer<typeof submitRegistrationSchema>["body"];
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsSchema>["query"];
export type UpdatePaymentStatusRequest = z.infer<typeof updatePaymentStatusSchema>["body"];
export type UpdateDecisionRequest = z.infer<typeof updateDecisionSchema>["body"];
