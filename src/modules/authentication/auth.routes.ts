import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import { AuthController } from "./auth.controller.js";
import {
  adminLoginRequestSchema,
  appEmailGateRequestSchema,
  appLoginRequestSchema,
  completePasswordResetSchema,
  requestPasswordResetSchema,
  requestVerificationCodeSchema,
  setPasswordRequestSchema,
  verifyCodeRequestSchema,
  verifyPasswordResetCodeSchema,
} from "./auth.schemas.js";

export function createAdminAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/login", validateRequest(adminLoginRequestSchema), controller.adminLogin);
  return router;
}

/**
 * `authGuard` (bearer-token verification, without the paid/eligible
 * recheck) is only needed for `/logout` — logging out just needs to know
 * who the token belongs to, not whether they're still eligible.
 */
export function createAppAuthRouter(controller: AuthController, authGuard: RequestHandler): Router {
  const router = Router();
  router.post("/email-gate", validateRequest(appEmailGateRequestSchema), controller.emailGate);
  router.post("/verification-code", validateRequest(requestVerificationCodeSchema), controller.requestVerificationCode);
  router.post("/verify-code", validateRequest(verifyCodeRequestSchema), controller.verifyCode);
  router.post("/set-password", validateRequest(setPasswordRequestSchema), controller.setPassword);
  router.post("/login", validateRequest(appLoginRequestSchema), controller.appLogin);

  // Gap 1 — password reset
  router.post("/password-reset/request", validateRequest(requestPasswordResetSchema), controller.requestPasswordReset);
  router.post("/password-reset/verify", validateRequest(verifyPasswordResetCodeSchema), controller.verifyPasswordResetCode);
  router.post("/password-reset/complete", validateRequest(completePasswordResetSchema), controller.completePasswordReset);

  // Gap 5 — logout
  router.post("/logout", authGuard, controller.logout);

  return router;
}
