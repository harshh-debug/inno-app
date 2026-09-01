import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { AppProfileController } from "./app-profile.controller.js";
import { updateProfileRequestSchema } from "./app-profile.schemas.js";

export function createAppProfileRouter(controller: AppProfileController, guard: RequestHandler[]): Router {
  const router = Router();
  router.get("/me", guard, controller.getMe);
  router.patch("/me", guard, validateRequest(updateProfileRequestSchema), controller.patchMe);
  router.get("/recruitment", guard, controller.getRecruitment);
  return router;
}
