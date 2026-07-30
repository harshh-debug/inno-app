import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaRecruitmentCycleRepository } from "./recruitment-cycle.repository.js";
import { RecruitmentCycleService } from "./recruitment-cycle.service.js";
import { RecruitmentCycleController } from "./recruitment-cycle.controller.js";

/** Composition root for recruitment-cycle management and active-cycle resolution. */
export function createRecruitmentCyclesModule(prisma: PrismaClient) {
  const repository = new PrismaRecruitmentCycleRepository(prisma);
  const service = new RecruitmentCycleService(repository, (operation) =>
    prisma.$transaction((transaction) => operation(new PrismaRecruitmentCycleRepository(transaction))),
  );
  const controller = new RecruitmentCycleController(service);

  return {
    repository,
    service,
    controller,
    /** Use inside a caller-owned Prisma transaction, never inside a request handler. */
    forTransaction(transaction: Prisma.TransactionClient) {
      const transactionRepository = new PrismaRecruitmentCycleRepository(transaction);
      return {
        repository: transactionRepository,
        service: new RecruitmentCycleService(transactionRepository, async (operation) =>
          operation(transactionRepository),
        ),
      };
    },
  };
}

export type RecruitmentCyclesModule = ReturnType<typeof createRecruitmentCyclesModule>;
