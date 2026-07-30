import { z } from "zod";

const cycleIdParams = z.object({ cycleId: z.uuid() });

export const createRecruitmentCycleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    academicYear: z.string().trim().min(1).max(30),
  }),
});

export const updateRecruitmentCycleSchema = z.object({
  params: cycleIdParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      academicYear: z.string().trim().min(1).max(30).optional(),
    })
    .refine((value) => value.name !== undefined || value.academicYear !== undefined, {
      message: "At least one field must be provided",
    }),
});

export const cycleIdParamSchema = z.object({ params: cycleIdParams });

export type CreateRecruitmentCycleRequest = z.infer<typeof createRecruitmentCycleSchema>["body"];
export type UpdateRecruitmentCycleRequest = z.infer<typeof updateRecruitmentCycleSchema>["body"];
