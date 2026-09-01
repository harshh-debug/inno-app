import { Router } from "express";
import type { AuthController } from "../../modules/authentication/auth.controller.js";
import { createAdminAuthRouter, createAppAuthRouter } from "../../modules/authentication/auth.routes.js";
import {
  authenticateAccessToken,
  requireAdmin,
  requireAppStudent,
} from "../../modules/authentication/auth.middleware.js";
import type { AuthService } from "../../modules/authentication/auth.service.js";
import type { AccessTokenService } from "../../modules/authentication/token.js";
import type { TokenDenylist } from "../../modules/authentication/token-denylist.js";
import type { RecruitmentCycleController } from "../../modules/recruitment-cycles/recruitment-cycle.controller.js";
import { createAdminRecruitmentCycleRouter } from "../../modules/recruitment-cycles/recruitment-cycle.routes.js";
import type { FormController, AdminRegistrationController } from "../../modules/registrations/admin/index.js";
import { createAdminFormRouter, createAdminRegistrationRouter } from "../../modules/registrations/admin/index.js";
import type { PublicRegistrationController } from "../../modules/registrations/public/index.js";
import { createPublicRegistrationRouter } from "../../modules/registrations/public/index.js";
import type { AppProfileController } from "../../modules/app-profile/app-profile.controller.js";
import { createAppProfileRouter } from "../../modules/app-profile/app-profile.routes.js";
import type { TestSlotController } from "../../modules/test-slots/test-slot.controller.js";
import {
  createAdminCycleTestSlotRouter,
  createAdminRegistrationTestSlotRouter,
  createAdminTestSlotRouter,
  createTestSlotRouter,
} from "../../modules/test-slots/test-slot.routes.js";
import type { UserController } from "../../modules/users/user.controller.js";
import { createAdminUserRouter } from "../../modules/users/user.routes.js";

export interface AuthenticationRouterDependencies {
  controller: AuthController;
  tokens: AccessTokenService;
  service: AuthService;
  denylist: TokenDenylist;
}

export interface RecruitmentCyclesRouterDependencies {
  controller: RecruitmentCycleController;
}

export interface RegistrationsRouterDependencies {
  formController: FormController;
  adminRegistrationController: AdminRegistrationController;
  publicRegistrationController: PublicRegistrationController;
}

export interface AppProfileRouterDependencies {
  controller: AppProfileController;
}

export interface TestSlotsRouterDependencies {
  controller: TestSlotController;
}

export interface UsersRouterDependencies {
  controller: UserController;
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
  appProfile?: AppProfileRouterDependencies,
  testSlots?: TestSlotsRouterDependencies,
  users?: UsersRouterDependencies,
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
    // Verifies the bearer token and checks it hasn't been logged out. Used
    // wherever we only need to know *who* the caller is (e.g. logout itself).
    const bearerGuard = authenticateAccessToken(authentication.tokens, authentication.denylist);

    adminRouter.use("/auth", createAdminAuthRouter(authentication.controller));
    appRouter.use("/auth", createAppAuthRouter(authentication.controller, bearerGuard));

    const adminGuard = [bearerGuard, requireAdmin(authentication.service)];

    // Rechecks paid/eligible status on every call, not just at login — see
    // gap 4. Everything under /app other than /auth needs this, not just
    // the bearer check.
    const appStudentGuard = [bearerGuard, requireAppStudent(authentication.service)];

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

    if (appProfile !== undefined) {
      appRouter.use(createAppProfileRouter(appProfile.controller, appStudentGuard));
    }

    if (testSlots !== undefined) {
      appRouter.use(createTestSlotRouter(testSlots.controller, appStudentGuard));
      adminRouter.use(
        "/recruitment-cycles/:cycleId/test-slots",
        createAdminCycleTestSlotRouter(testSlots.controller, adminGuard),
      );
      adminRouter.use("/test-slots", createAdminTestSlotRouter(testSlots.controller, adminGuard));
      adminRouter.use(createAdminRegistrationTestSlotRouter(testSlots.controller, adminGuard));
    }

    if (users !== undefined) {
      adminRouter.use("/users", createAdminUserRouter(users.controller, adminGuard));
    }
  }

  router.use("/admin", adminRouter);
  router.use("/app", appRouter);

  return router;
}
