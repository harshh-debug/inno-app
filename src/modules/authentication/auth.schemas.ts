import { z } from "zod";

const email = z.object({ collegeEmail: z.email().max(320) });
const password = z.string().min(8).max(128);

export const adminLoginRequestSchema = z.object({ body: email.extend({ password }) });
export const appEmailGateRequestSchema = z.object({ body: email });
export const requestVerificationCodeSchema = z.object({ body: email });
export const verifyCodeRequestSchema = z.object({ body: email.extend({ code: z.string().regex(/^\d{6}$/) }) });
export const setPasswordRequestSchema = z.object({
  body: z.object({ passwordSetupToken: z.string().min(20), password }),
});
export const appLoginRequestSchema = z.object({ body: email.extend({ password }) });

export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>["body"];
export type AppEmailRequest = z.infer<typeof appEmailGateRequestSchema>["body"];
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>["body"];
export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>["body"];
export type AppLoginRequest = z.infer<typeof appLoginRequestSchema>["body"];
