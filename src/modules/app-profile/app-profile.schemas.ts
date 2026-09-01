import { z } from "zod";

// PATCH /app/me — only the two fields a student can self-edit. Batch/year/role
// are admin-panel-only (the club only recruits first-years, so those aren't
// self-reported); collegeEmail is the immutable login identity.
// Accepts digits with an optional leading + and space/hyphen separators (e.g. "+91 98765
// 43210"), but strips the separators before storage so the stored value is always compact
// (e.g. "+919876543210") regardless of how the client formatted it.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]+$/, "Phone must contain only digits, spaces, hyphens, and an optional leading +")
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => {
    const digitCount = value.replace(/\D/g, "").length;
    return digitCount >= 7 && digitCount <= 15;
  }, "Phone must contain 7-15 digits");

export const updateProfileRequestSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(1).max(200).optional(),
      phone: phone.optional(),
    })
    .refine((data) => data.fullName !== undefined || data.phone !== undefined, {
      message: "At least one of fullName or phone must be provided",
    }),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>["body"];
