import { z } from "zod";

const userIdParams = z.object({ userId: z.uuid() });

export const promoteUserSchema = z.object({
  params: userIdParams,
  body: z.object({
    role: z.enum(["REGISTERED", "MEMBER", "COORDINATOR", "ADMIN"]),
    domain: z.enum(["ANDROID", "WEB", "ML", "IOT", "AR_VR"]).optional(),
  }),
});

export type PromoteUserRequest = z.infer<typeof promoteUserSchema>["body"];
