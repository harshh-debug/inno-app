import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { InterviewSlotController } from "./interview-slot.controller.js";
import {
  createInterviewSlotSchema,
  cycleIdParamSchema,
  slotIdParamSchema,
  updateInterviewSlotSchema,
  assignInterviewSlotSchema,
} from "./interview-slot.schemas.js";

/** Student reads their own admin-assigned interview slot; there is no self-booking. */
export function createInterviewSlotRouter(controller: InterviewSlotController, guard: RequestHandler[]): Router {
  const router = Router();
  router.get("/interview-booking", guard, controller.getMyBooking);
  return router;
}

/** Mounted at /api/v1/admin/recruitment-cycles/:cycleId/interview-slots. Admin-only. */
export function createAdminCycleInterviewSlotRouter(
  controller: InterviewSlotController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router({ mergeParams: true });
  router.use(...adminGuard);

  router.get("/", validateRequest(cycleIdParamSchema), controller.listSlotsForCycle);
  router.post("/", validateRequest(createInterviewSlotSchema), controller.createSlot);

  return router;
}

/** Mounted at /api/v1/admin/interview-slots. Admin-only. */
export function createAdminInterviewSlotRouter(
  controller: InterviewSlotController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.patch("/:slotId", validateRequest(updateInterviewSlotSchema), controller.updateSlot);
  router.get("/:slotId/bookings", validateRequest(slotIdParamSchema), controller.listBookings);

  return router;
}

/**
 * Admin assigns/reassigns a registration's interview slot. Mounted at the
 * /api/v1/admin root, sharing the `/registrations/:registrationId/...`
 * resource path already used by the admin registrations and test-slot
 * assignment routers.
 */
export function createAdminRegistrationInterviewSlotRouter(
  controller: InterviewSlotController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.patch(
    "/registrations/:registrationId/interview-slot",
    validateRequest(assignInterviewSlotSchema),
    controller.assignSlot,
  );

  return router;
}
