import type { Request, Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthenticatedRequest } from "../authentication/auth.middleware.js";
import type {
  BookTestSlotRequest,
  CreateTestSlotRequest,
  ReorderTestSlotsRequest,
  UpdateTestSlotRequest,
} from "./test-slot.schemas.js";
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

  listSlotsForCycle = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    response.json({ data: await this.service.listSlotsForCycle(cycleId) });
  };

  createSlot = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const body = request.body as CreateTestSlotRequest;
    const slot = await this.service.createSlot(cycleId, body);
    response.status(201).json({ data: slot });
  };

  updateSlot = async (request: Request, response: Response): Promise<void> => {
    const { slotId } = request.params as { slotId: string };
    const { confirmTimeChange, ...input } = request.body as UpdateTestSlotRequest;
    const slot = await this.service.updateSlot(slotId, input, confirmTimeChange);
    response.json({ data: slot });
  };

  reorderSlots = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const body = request.body as ReorderTestSlotsRequest;
    response.json({ data: await this.service.reorderSlots(cycleId, body.testSlotIds) });
  };

  listBookings = async (request: Request, response: Response): Promise<void> => {
    const { slotId } = request.params as { slotId: string };
    response.json({ data: await this.service.listBookings(slotId) });
  };
}
