import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { TestSlotController } from "./test-slot.controller.js";
import { PrismaTestSlotRepository } from "./test-slot.repository.js";
import { TestSlotService } from "./test-slot.service.js";

/** Composition root for Module 7 (test-slot listing and booking). */
export function createTestSlotModule(prisma: PrismaClient) {
  const repository = new PrismaTestSlotRepository(prisma);
  const service = new TestSlotService(repository, (operation) =>
    prisma.$transaction((transaction: Prisma.TransactionClient) =>
      operation(new PrismaTestSlotRepository(transaction)),
    ),
  );
  const controller = new TestSlotController(service);
  return { repository, service, controller };
}
