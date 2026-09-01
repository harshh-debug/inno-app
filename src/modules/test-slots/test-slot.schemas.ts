import { z } from "zod";

const cycleIdParams = z.object({ cycleId: z.uuid() });
const slotIdParams = z.object({ slotId: z.uuid() });
const registrationIdParams = z.object({ registrationId: z.uuid() });

export const assignTestSlotSchema = z.object({
  params: registrationIdParams,
  body: z.object({
    testSlotId: z.uuid(),
  }),
});

export const cycleIdParamSchema = z.object({ params: cycleIdParams });
export const slotIdParamSchema = z.object({ params: slotIdParams });

export const createTestSlotSchema = z.object({
  params: cycleIdParams,
  body: z
    .object({
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      capacity: z.number().int().min(1),
      isVisible: z.boolean().optional().default(false),
    })
    .refine((value) => value.endTime > value.startTime, {
      message: "endTime must be after startTime",
      path: ["endTime"],
    }),
});

export const updateTestSlotSchema = z.object({
  params: slotIdParams,
  body: z
    .object({
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      capacity: z.number().int().min(1).optional(),
      isVisible: z.boolean().optional(),
      confirmTimeChange: z.boolean().optional().default(false),
    })
    .refine(
      (value) =>
        value.startTime !== undefined ||
        value.endTime !== undefined ||
        value.capacity !== undefined ||
        value.isVisible !== undefined,
      { message: "At least one field must be provided" },
    )
    .refine(
      (value) => value.startTime === undefined || value.endTime === undefined || value.endTime > value.startTime,
      { message: "endTime must be after startTime", path: ["endTime"] },
    ),
});

export const reorderTestSlotsSchema = z.object({
  params: cycleIdParams,
  body: z.object({ testSlotIds: z.array(z.uuid()).min(1) }),
});

export type AssignTestSlotRequest = z.infer<typeof assignTestSlotSchema>["body"];
export type CreateTestSlotRequest = z.infer<typeof createTestSlotSchema>["body"];
export type UpdateTestSlotRequest = z.infer<typeof updateTestSlotSchema>["body"];
export type ReorderTestSlotsRequest = z.infer<typeof reorderTestSlotsSchema>["body"];
