import type { Request, Response } from "express";
import type { RecruitmentCycleService } from "./recruitment-cycle.service.js";
import type {
  CreateRecruitmentCycleRequest,
  UpdateRecruitmentCycleRequest,
} from "./recruitment-cycle.schemas.js";

export class RecruitmentCycleController {
  constructor(private readonly recruitmentCycleService: RecruitmentCycleService) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as CreateRecruitmentCycleRequest;
    const cycle = await this.recruitmentCycleService.create(body);
    response.status(201).json({ data: cycle });
  };

  list = async (_request: Request, response: Response): Promise<void> => {
    const cycles = await this.recruitmentCycleService.list();
    response.json({ data: cycles });
  };

  getOne = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const cycle = await this.recruitmentCycleService.getById(cycleId);
    response.json({ data: cycle });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const body = request.body as UpdateRecruitmentCycleRequest;
    const cycle = await this.recruitmentCycleService.update(cycleId, body);
    response.json({ data: cycle });
  };

  activate = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const cycle = await this.recruitmentCycleService.activate(cycleId);
    response.json({ data: cycle });
  };
}
