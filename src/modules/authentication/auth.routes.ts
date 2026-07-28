import { Router } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import { AuthController } from "./auth.controller.js";
import {
  adminLoginRequestSchema,
  appEmailGateRequestSchema,
  appLoginRequestSchema,
  requestVerificationCodeSchema,
  setPasswordRequestSchema,
  verifyCodeRequestSchema,
} from "./auth.schemas.js";

export function createAdminAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/login", validateRequest(adminLoginRequestSchema), controller.adminLogin);
  return router;
}

export function createAppAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post("/email-gate", validateRequest(appEmailGateRequestSchema), controller.emailGate);
  router.post("/verification-code", validateRequest(requestVerificationCodeSchema), controller.requestVerificationCode);
  router.post("/verify-code", validateRequest(verifyCodeRequestSchema), controller.verifyCode);
  router.post("/set-password", validateRequest(setPasswordRequestSchema), controller.setPassword);
  router.post("/login", validateRequest(appLoginRequestSchema), controller.appLogin);
  return router;
}
