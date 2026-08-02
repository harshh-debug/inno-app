import type { Response } from "express";
import type { AuthenticatedRequest } from "../../authentication/auth.middleware.js";
import type { RegistrationService } from "../registration.service.js";
import type {
  ListRegistrationsQuery,
  UpdateDecisionRequest,
  UpdatePaymentStatusRequest,
} from "../registration.schemas.js";

/** Protected admin registration HTTP adapter. */
export class AdminRegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  list = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const query = request.query as unknown as ListRegistrationsQuery;
    const result = await this.registrationService.listForAdmin(cycleId, query);
    response.json({ data: result });
  };

  getOne = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const { registrationId } = request.params as { registrationId: string };
    const result = await this.registrationService.getDetailForAdmin(registrationId);
    response.json({ data: result });
  };

  updatePaymentStatus = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const { registrationId } = request.params as { registrationId: string };
    const body = request.body as UpdatePaymentStatusRequest;
    const result = await this.registrationService.updatePaymentStatus(registrationId, body.paymentStatus);
    response.json({ data: result });
  };

  updateDecision = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    const { registrationId } = request.params as { registrationId: string };
    const body = request.body as UpdateDecisionRequest;
    // requireAdmin has already run and guarantees request.auth is set.
    const actorId = request.auth!.userId;
    const result = await this.registrationService.updateDecision(registrationId, body, actorId);
    response.json({ data: result });
  };
}
