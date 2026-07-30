import type {
  Prisma,
  PrismaClient,
  RecruitmentCycle,
} from "../../../generated/prisma/client.js";
import type {
  CreateRecruitmentCycleInput,
  RecruitmentCycleRepository,
  UpdateRecruitmentCycleInput,
} from "./recruitment-cycle.types.js";

type RecruitmentCycleDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for recruitment-cycle records. */
export class PrismaRecruitmentCycleRepository implements RecruitmentCycleRepository {
  constructor(private readonly prisma: RecruitmentCycleDatabaseClient) {}

  findById = (id: string): Promise<RecruitmentCycle | null> => {
    return this.prisma.recruitmentCycle.findUnique({ where: { id } });
  };

  findActive = (): Promise<RecruitmentCycle | null> => {
    return this.prisma.recruitmentCycle.findFirst({ where: { isActive: true } });
  };

  list = (): Promise<RecruitmentCycle[]> => {
    return this.prisma.recruitmentCycle.findMany({ orderBy: { createdAt: "desc" } });
  };

  create = (input: CreateRecruitmentCycleInput): Promise<RecruitmentCycle> => {
    return this.prisma.recruitmentCycle.create({
      data: { name: input.name, academicYear: input.academicYear, isActive: false },
    });
  };

  update = (id: string, input: UpdateRecruitmentCycleInput): Promise<RecruitmentCycle> => {
    return this.prisma.recruitmentCycle.update({ where: { id }, data: input });
  };

  deactivateAllActive = async (): Promise<void> => {
    await this.prisma.recruitmentCycle.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  };

  setActive = (id: string): Promise<RecruitmentCycle> => {
    return this.prisma.recruitmentCycle.update({ where: { id }, data: { isActive: true } });
  };
}
