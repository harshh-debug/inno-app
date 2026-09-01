import { z } from "zod";

const cycleIdParams = z.object({ cycleId: z.uuid() });
const slotIdParams = z.object({ slotId: z.uuid() });
const registrationIdParams = z.object({ registrationId: z.uuid() });

export const cycleIdParamSchema = z.object({ params: cycleIdParams });
export const slotIdParamSchema = z.object({ params: slotIdParams });

export const assignInterviewSlotSchema = z.object({
  params: registrationIdParams,
  body: z.object({
    interviewSlotId: z.uuid(),
  }),
});

export const createInterviewSlotSchema = z.object({
  params: cycleIdParams,
  body: z
    .object({
      interviewerName: z.string().trim().min(1).max(200),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      location: z.string().trim().min(1).optional(),
      meetingUrl: z.string().trim().min(1).optional(),
      capacity: z.number().int().min(1),
      isCancelled: z.boolean().optional().default(false),
    })
    .refine((value) => value.endTime > value.startTime, {
      message: "endTime must be after startTime",
      path: ["endTime"],
    }),
});

export const updateInterviewSlotSchema = z.object({
  params: slotIdParams,
  body: z
    .object({
      interviewerName: z.string().trim().min(1).max(200).optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      location: z.string().trim().min(1).optional(),
      meetingUrl: z.string().trim().min(1).optional(),
      capacity: z.number().int().min(1).optional(),
      isCancelled: z.boolean().optional(),
      confirmTimeChange: z.boolean().optional().default(false),
    })
    .refine(
      (value) =>
        value.interviewerName !== undefined ||
        value.startTime !== undefined ||
        value.endTime !== undefined ||
        value.location !== undefined ||
        value.meetingUrl !== undefined ||
        value.capacity !== undefined ||
        value.isCancelled !== undefined,
      { message: "At least one field must be provided" },
    )
    .refine(
      (value) => value.startTime === undefined || value.endTime === undefined || value.endTime > value.startTime,
      { message: "endTime must be after startTime", path: ["endTime"] },
    ),
});

export type AssignInterviewSlotRequest = z.infer<typeof assignInterviewSlotSchema>["body"];
export type CreateInterviewSlotRequest = z.infer<typeof createInterviewSlotSchema>["body"];
export type UpdateInterviewSlotRequest = z.infer<typeof updateInterviewSlotSchema>["body"];
