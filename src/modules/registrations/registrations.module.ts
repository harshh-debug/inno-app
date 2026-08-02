import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { RecruitmentCyclesModule } from "../recruitment-cycles/recruitment-cycles.module.js";
import { PrismaRecruitmentCycleRepository } from "../recruitment-cycles/recruitment-cycle.repository.js";
import { RecruitmentCycleService } from "../recruitment-cycles/recruitment-cycle.service.js";
import type { createUsersModule } from "../users/users.module.js";
import { PrismaFormRepository, FormService } from "./form/index.js";
import { FormController, AdminRegistrationController } from "./admin/index.js";
import { PublicRegistrationController } from "./public/index.js";
import { PrismaRegistrationRepository } from "./registration.repository.js";
import { RegistrationService } from "./registration.service.js";

/**
 * Composition root for Module 5 (forms + public registration + admin
 * registration operations). Depends on recruitment-cycles for active-cycle
 * resolution and on the shared users module for identity matching during
 * submission (its transaction-bound instance is used, never the request-scoped one).
 */
export function createRegistrationsModule(
  prisma: PrismaClient,
  recruitmentCycles: RecruitmentCyclesModule,
  users: ReturnType<typeof createUsersModule>,
  notificationService: NotificationService,
) {
  const formRepository = new PrismaFormRepository(prisma);
  const formService = new FormService(
    formRepository,
    recruitmentCycles.service,
    (operation) =>
      prisma.$transaction((transaction: Prisma.TransactionClient) =>
        operation(new PrismaFormRepository(transaction)),
      ),
  );
  const formController = new FormController(formService);

  const registrationRepository = new PrismaRegistrationRepository(prisma);
  const registrationService = new RegistrationService(
    registrationRepository,
    recruitmentCycles.service,
    formService,
    notificationService,
    (operation) =>
      prisma.$transaction((transaction: Prisma.TransactionClient) => {
        const transactionRegistrationRepository = new PrismaRegistrationRepository(transaction);
        const { userService: transactionUserService } = users.forTransaction(transaction);
        const transactionRecruitmentCycleRepository = new PrismaRecruitmentCycleRepository(transaction);
        const transactionRecruitmentCycleService = new RecruitmentCycleService(
          transactionRecruitmentCycleRepository,
          (nestedOperation) => nestedOperation(transactionRecruitmentCycleRepository),
        );
        const transactionFormService = new FormService(
          new PrismaFormRepository(transaction),
          transactionRecruitmentCycleService,
          (nestedOperation) => nestedOperation(new PrismaFormRepository(transaction)),
        );
        return operation({
          registrationRepository: transactionRegistrationRepository,
          userService: transactionUserService,
          recruitmentCycleService: transactionRecruitmentCycleService,
          formService: transactionFormService,
        });
      }),
  );

  const adminRegistrationController = new AdminRegistrationController(registrationService);
  const publicRegistrationController = new PublicRegistrationController(registrationService, formService);

  return {
    formRepository,
    formService,
    formController,
    registrationRepository,
    registrationService,
    adminRegistrationController,
    publicRegistrationController,
  };
}

export type RegistrationsModule = ReturnType<typeof createRegistrationsModule>;
