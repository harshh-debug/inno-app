import type { Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthenticatedRequest } from "../authentication/auth.middleware.js";
import type { AppProfileService } from "./app-profile.service.js";

export class AppProfileController {
  constructor(private readonly service: AppProfileService) {}

  getMe = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    response.json({ data: await this.service.getProfile(request.auth.userId) });
  };

  getRecruitment = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    response.json({ data: await this.service.getRecruitmentSummary(request.auth.userId) });
  };
}
