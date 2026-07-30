import type { RecruitmentCycle } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../common/prisma-errors.js";
import type {
  CreateRecruitmentCycleInput,
  RecruitmentCycleRepository,
  UpdateRecruitmentCycleInput,
} from "./recruitment-cycle.types.js";

/**
 * Owns recruitment-cycle lifecycle rules. Public and app clients never see
 * this service directly; forms and registrations resolve the active cycle
 * through `getActiveCycleOrThrow`.
 */
export class RecruitmentCycleService {
  constructor(
    private readonly recruitmentCycleRepository: RecruitmentCycleRepository,
    private readonly transaction: <T>(
      operation: (repository: RecruitmentCycleRepository) => Promise<T>,
    ) => Promise<T>,
  ) {}

  async create(input: CreateRecruitmentCycleInput): Promise<RecruitmentCycle> {
    try {
      return await this.recruitmentCycleRepository.create(input);
    } catch (error) {
      this.throwIfDuplicateYear(error);
    }
  }

  list(): Promise<RecruitmentCycle[]> {
    return this.recruitmentCycleRepository.list();
  }

  async getById(id: string): Promise<RecruitmentCycle> {
    const cycle = await this.recruitmentCycleRepository.findById(id);
    if (cycle === null) {
      throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
    }
    return cycle;
  }

  async update(id: string, input: UpdateRecruitmentCycleInput): Promise<RecruitmentCycle> {
    await this.getById(id);
    try {
      return await this.recruitmentCycleRepository.update(id, input);
    } catch (error) {
      this.throwIfDuplicateYear(error);
    }
  }

  /** Atomically deactivates any currently active cycle and activates this one. */
  async activate(id: string): Promise<RecruitmentCycle> {
    return this.transaction(async (repository) => {
      const cycle = await repository.findById(id);
      if (cycle === null) {
        throw new AppError("RECRUITMENT_CYCLE_NOT_FOUND", 404, "Recruitment cycle not found");
      }

      await repository.deactivateAllActive();
      return repository.setActive(id);
    });
  }

  /** Used internally by other modules to resolve the single active cycle. */
  async getActiveCycleOrThrow(): Promise<RecruitmentCycle> {
    const cycle = await this.recruitmentCycleRepository.findActive();
    if (cycle === null) {
      throw new AppError(
        "NO_ACTIVE_RECRUITMENT_CYCLE",
        404,
        "There is no active recruitment cycle",
      );
    }
    return cycle;
  }

  private throwIfDuplicateYear(error: unknown): never {
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError(
        "DUPLICATE_ACADEMIC_YEAR",
        409,
        "A recruitment cycle for this academic year already exists",
      );
    }
    throw error;
  }
}
