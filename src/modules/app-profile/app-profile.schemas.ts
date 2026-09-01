import { z } from "zod";

// PATCH /app/me — only the two fields a student can self-edit. Batch/year/role
// are admin-panel-only (the club only recruits first-years, so those aren't
// self-reported); collegeEmail is the immutable login identity.
// Digits with an optional leading + and optional space/hyphen separators, 7-15 digits total —
// permissive enough for international numbers, strict enough to reject obvious garbage.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]+$/, "Phone must contain only digits, spaces, hyphens, and an optional leading +")
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
