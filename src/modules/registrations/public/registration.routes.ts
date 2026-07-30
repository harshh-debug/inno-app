import { Router } from "express";
import { validateRequest } from "../../../common/validation/validate-request.js";
import type { PublicRegistrationController } from "./registration.controller.js";
import { submitRegistrationSchema } from "../registration.schemas.js";

/** Mounted at /api/v1/public. */
export function createPublicRegistrationRouter(controller: PublicRegistrationController): Router {
  const router = Router();
  router.get("/registration-form", controller.getPublicForm);
  router.post("/registrations", validateRequest(submitRegistrationSchema), controller.submit);
  return router;
}
