import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { TestSlotController } from "./test-slot.controller.js";
import {
  assignTestSlotSchema,
  bookTestSlotSchema,
  createTestSlotSchema,
  cycleIdParamSchema,
  reorderTestSlotsSchema,
  setTestResultSchema,
  slotIdParamSchema,
  updateTestSlotSchema,
} from "./test-slot.schemas.js";

/** Student lists slots, books/switches their own, and reads their current booking. */
export function createTestSlotRouter(controller: TestSlotController, guard: RequestHandler[]): Router {
  const router = Router();
  router.get("/test-slots", guard, controller.listSlots);
  router.get("/test-slot-booking", guard, controller.getMyBooking);
  router.post("/test-slot-booking", guard, validateRequest(bookTestSlotSchema), controller.bookSlot);
  return router;
}

/** Mounted at /api/v1/admin/recruitment-cycles/:cycleId/test-slots. Admin-only, per IMPLEMENTATION_PLAN §10. */
export function createAdminCycleTestSlotRouter(
  controller: TestSlotController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router({ mergeParams: true });
  router.use(...adminGuard);

  router.get("/", validateRequest(cycleIdParamSchema), controller.listSlotsForCycle);
  router.post("/", validateRequest(createTestSlotSchema), controller.createSlot);
  router.put("/order", validateRequest(reorderTestSlotsSchema), controller.reorderSlots);

  return router;
}

/** Mounted at /api/v1/admin/test-slots. Admin-only, per IMPLEMENTATION_PLAN §10. */
export function createAdminTestSlotRouter(controller: TestSlotController, adminGuard: RequestHandler[]): Router {
  const router = Router();
  router.use(...adminGuard);

  router.patch("/:slotId", validateRequest(updateTestSlotSchema), controller.updateSlot);
  router.get("/:slotId/bookings", validateRequest(slotIdParamSchema), controller.listBookings);

  return router;
}

/**
 * Admin assigns/reassigns a registration's test slot. Mounted at the
 * /api/v1/admin root, sharing the `/registrations/:registrationId/...`
 * resource path already used by the admin registrations router.
 */
export function createAdminRegistrationTestSlotRouter(
  controller: TestSlotController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.patch("/registrations/:registrationId/test-slot", validateRequest(assignTestSlotSchema), controller.assignSlot);
  router.patch("/registrations/:registrationId/test-result", validateRequest(setTestResultSchema), controller.setTestResult);

  return router;
}
