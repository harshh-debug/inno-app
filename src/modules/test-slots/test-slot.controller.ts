import type { Request, Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthenticatedRequest } from "../authentication/auth.middleware.js";
import type {
  AssignTestSlotRequest,
  CreateTestSlotRequest,
  ReorderTestSlotsRequest,
  UpdateTestSlotRequest,
} from "./test-slot.schemas.js";
import type { TestSlotService } from "./test-slot.service.js";

export class TestSlotController {
  constructor(private readonly service: TestSlotService) {}

  getMyBooking = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    response.json({ data: await this.service.getMyBooking(request.auth.userId) });
  };

  assignSlot = async (request: Request, response: Response): Promise<void> => {
    const { registrationId } = request.params as { registrationId: string };
    const { testSlotId } = request.body as AssignTestSlotRequest;
    response.json({ data: await this.service.assignSlot(registrationId, testSlotId) });
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
