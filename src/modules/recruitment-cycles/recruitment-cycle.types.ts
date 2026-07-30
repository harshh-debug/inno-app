import type { RecruitmentCycle } from "../../../generated/prisma/client.js";

export interface CreateRecruitmentCycleInput {
  name: string;
  academicYear: string;
}

export interface UpdateRecruitmentCycleInput {
  name?: string;
  academicYear?: string;
}

export interface RecruitmentCycleRepository {
  findById(id: string): Promise<RecruitmentCycle | null>;
  findActive(): Promise<RecruitmentCycle | null>;
  list(): Promise<RecruitmentCycle[]>;
  create(input: CreateRecruitmentCycleInput): Promise<RecruitmentCycle>;
  update(id: string, input: UpdateRecruitmentCycleInput): Promise<RecruitmentCycle>;
  deactivateAllActive(): Promise<void>;
  setActive(id: string): Promise<RecruitmentCycle>;
}
