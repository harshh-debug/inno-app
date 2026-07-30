import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../../common/validation/validate-request.js";
import type { AdminRegistrationController } from "./registration.controller.js";
import {
  getRegistrationSchema,
  listRegistrationsSchema,
  updateDecisionSchema,
  updatePaymentStatusSchema,
} from "../registration.schemas.js";

/** Mounted at the /api/v1/admin root (shares the root with the recruitment-cycles router). */
export function createAdminRegistrationRouter(
  controller: AdminRegistrationController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.get(
    "/recruitment-cycles/:cycleId/registrations",
    validateRequest(listRegistrationsSchema),
    controller.list,
  );
  router.get(
    "/registrations/:registrationId",
    validateRequest(getRegistrationSchema),
    controller.getOne,
  );
  router.patch(
    "/registrations/:registrationId/payment-status",
    validateRequest(updatePaymentStatusSchema),
    controller.updatePaymentStatus,
  );
  router.patch(
    "/registrations/:registrationId/decision",
    validateRequest(updateDecisionSchema),
    controller.updateDecision,
  );

  return router;
}
