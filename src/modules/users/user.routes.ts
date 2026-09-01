import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { UserController } from "./user.controller.js";
import { promoteUserSchema } from "./user.schemas.js";

/** Mounted at /api/v1/admin/users. Admin-only, per 10_USER_FLOWS.md §5-6. */
export function createAdminUserRouter(controller: UserController, adminGuard: RequestHandler[]): Router {
  const router = Router();
  router.use(...adminGuard);
  router.patch("/:userId/role", validateRequest(promoteUserSchema), controller.promote);
  return router;
}
