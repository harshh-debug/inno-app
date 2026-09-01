import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { InterviewSlotController } from "./interview-slot.controller.js";
import { PrismaInterviewSlotRepository } from "./interview-slot.repository.js";
import { InterviewSlotService } from "./interview-slot.service.js";

/** Composition root for interview scheduling and assignment. */
export function createInterviewSlotModule(prisma: PrismaClient) {
  const repository = new PrismaInterviewSlotRepository(prisma);
  const service = new InterviewSlotService(repository, (operation) =>
    prisma.$transaction((transaction: Prisma.TransactionClient) =>
      operation(new PrismaInterviewSlotRepository(transaction)),
    ),
  );
  const controller = new InterviewSlotController(service);
  return { repository, service, controller };
}
