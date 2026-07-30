import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { RecruitmentCycleController } from "./recruitment-cycle.controller.js";
import {
  createRecruitmentCycleSchema,
  cycleIdParamSchema,
  updateRecruitmentCycleSchema,
} from "./recruitment-cycle.schemas.js";

/** Mounted at /api/v1/admin/recruitment-cycles. Admin-only, per PRD §21. */
export function createAdminRecruitmentCycleRouter(
  controller: RecruitmentCycleController,
  // authController: { controller: any },
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.post("/", validateRequest(createRecruitmentCycleSchema), controller.create);
  router.get("/", controller.list);
  router.get("/:cycleId", validateRequest(cycleIdParamSchema), controller.getOne);
  router.patch("/:cycleId", validateRequest(updateRecruitmentCycleSchema), controller.update);
  router.patch(
    "/:cycleId/activate",
    validateRequest(cycleIdParamSchema),
    controller.activate,
  );

  return router;
}
