import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import type { TestSlotController } from "./test-slot.controller.js";
import { bookTestSlotSchema } from "./test-slot.schemas.js";

export function createTestSlotRouter(controller: TestSlotController, guard: RequestHandler[]): Router {
  const router = Router();
  router.get("/test-slots", guard, controller.listSlots);
  router.get("/test-slot-booking", guard, controller.getMyBooking);
  router.post("/test-slot-booking", guard, validateRequest(bookTestSlotSchema), controller.bookSlot);
  return router;
}
