import type { Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthenticatedRequest } from "../authentication/auth.middleware.js";
import type { BookTestSlotRequest } from "./test-slot.schemas.js";
import type { TestSlotService } from "./test-slot.service.js";

export class TestSlotController {
  constructor(private readonly service: TestSlotService) {}

  listSlots = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    response.json({ data: { slots: await this.service.listAvailableSlots(request.auth.userId) } });
  };

  getMyBooking = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    response.json({ data: await this.service.getMyBooking(request.auth.userId) });
  };

  bookSlot = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    const { testSlotId } = request.body as BookTestSlotRequest;
    response.status(201).json({ data: await this.service.bookSlot(request.auth.userId, testSlotId) });
  };
}
