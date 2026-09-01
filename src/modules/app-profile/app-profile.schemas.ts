import { z } from "zod";

// PATCH /app/me — only the two fields a student can self-edit. Batch/year/role
// are admin-panel-only (the club only recruits first-years, so those aren't
// self-reported); collegeEmail is the immutable login identity.
export const updateProfileRequestSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(1).max(200).optional(),
      phone: z.string().trim().min(1).max(32).optional(),
    })
    .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
      message: "At least one of fullName or phone must be provided",
    }),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>["body"];
