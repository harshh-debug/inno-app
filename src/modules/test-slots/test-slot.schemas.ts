import { z } from "zod";

export const bookTestSlotSchema = z.object({
  body: z.object({
    testSlotId: z.uuid(),
  }),
});

export type BookTestSlotRequest = z.infer<typeof bookTestSlotSchema>["body"];
