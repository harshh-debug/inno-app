import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { AppProfileController } from "./app-profile.controller.js";
import { updateProfileRequestSchema } from "./app-profile.schemas.js";

/**
 * `bearerGuard` alone (not `requireAppStudent`) protects the deletion-cancel
 * route: a pending-deletion account fails requireAppStudent by design (see
 * AuthService.requireEligibleAppStudent), so cancelling needs a lighter guard
 * that only proves who the caller is.
 */
export function createAppProfileRouter(
  controller: AppProfileController,
  guard: RequestHandler[],
  bearerGuard: RequestHandler[],
): Router {
  const router = Router();
  router.get("/me", guard, controller.getMe);
  router.patch("/me", guard, validateRequest(updateProfileRequestSchema), controller.patchMe);
  router.get("/recruitment", guard, controller.getRecruitment);
  router.post("/me/deletion-request", guard, controller.requestDeletion);
  router.delete("/me/deletion-request", bearerGuard, controller.cancelDeletion);
  return router;
}
