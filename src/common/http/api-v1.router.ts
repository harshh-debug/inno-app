import { Router } from "express";
import type { AuthController } from "../../modules/authentication/auth.controller.js";
import { createAdminAuthRouter, createAppAuthRouter } from "../../modules/authentication/auth.routes.js";
import { authenticateAccessToken, requireAdmin } from "../../modules/authentication/auth.middleware.js";
import type { AuthService } from "../../modules/authentication/auth.service.js";
import type { AccessTokenService } from "../../modules/authentication/token.js";
import type { RecruitmentCycleController } from "../../modules/recruitment-cycles/recruitment-cycle.controller.js";
import { createAdminRecruitmentCycleRouter } from "../../modules/recruitment-cycles/recruitment-cycle.routes.js";
import type { FormController, AdminRegistrationController } from "../../modules/registrations/admin/index.js";
import { createAdminFormRouter, createAdminRegistrationRouter } from "../../modules/registrations/admin/index.js";
import type { PublicRegistrationController } from "../../modules/registrations/public/index.js";
import { createPublicRegistrationRouter } from "../../modules/registrations/public/index.js";

export interface AuthenticationRouterDependencies {
  controller: AuthController;
  tokens: AccessTokenService;
  service: AuthService;
}

export interface RecruitmentCyclesRouterDependencies {
  controller: RecruitmentCycleController;
}

export interface RegistrationsRouterDependencies {
  formController: FormController;
  adminRegistrationController: AdminRegistrationController;
  publicRegistrationController: PublicRegistrationController;
}

/**
 * Stable client namespaces. Feature routers are mounted here as their modules
 * are implemented. Admin-only routers require `authentication` to be
 * supplied, since that is the source of the bearer-token and admin-role
 * guard middleware they run behind.
 */
export function createApiV1Router(
  authentication?: AuthenticationRouterDependencies,
  recruitmentCycles?: RecruitmentCyclesRouterDependencies,
  registrations?: RegistrationsRouterDependencies,
): Router {
  const router = Router();

  const publicRouter = Router();
  if (registrations !== undefined) {
    publicRouter.use(createPublicRegistrationRouter(registrations.publicRegistrationController));
  }
  router.use("/public", publicRouter);

  const adminRouter = Router();
  const appRouter = Router();

  if (authentication !== undefined) {
    adminRouter.use("/auth", createAdminAuthRouter(authentication.controller));
    appRouter.use("/auth", createAppAuthRouter(authentication.controller));

    const adminGuard = [
      authenticateAccessToken(authentication.tokens),
      requireAdmin(authentication.service),
    ];

    if (recruitmentCycles !== undefined) {
      adminRouter.use(
        "/recruitment-cycles",
        createAdminRecruitmentCycleRouter(recruitmentCycles.controller, adminGuard),
      );
    }

    if (registrations !== undefined) {
      adminRouter.use(createAdminFormRouter(registrations.formController, adminGuard));
      adminRouter.use(
        createAdminRegistrationRouter(registrations.adminRegistrationController, adminGuard),
      );
    }
  }

  router.use("/admin", adminRouter);
  router.use("/app", appRouter);

  return router;
}
