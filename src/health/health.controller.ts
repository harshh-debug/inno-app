import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  health = (_request: Request, response: Response): void => {
    response.status(200).json({ status: "ok" });
  };

  ready = async (_request: Request, response: Response): Promise<void> => {
    const isDatabaseReady = await this.healthService.isDatabaseReady();

    if (!isDatabaseReady) {
      response.status(503).json({ status: "not_ready", database: "down" });
      return;
    }

    response.status(200).json({ status: "ready", database: "up" });
  };
}
