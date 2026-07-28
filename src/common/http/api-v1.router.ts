import { Router } from "express";
import type { AuthController } from "../../modules/authentication/auth.controller.js";
import { createAdminAuthRouter, createAppAuthRouter } from "../../modules/authentication/auth.routes.js";

/**
 * Stable client namespaces. Feature routers are mounted here as their modules
 * are implemented; Phase 0 deliberately exposes no product endpoints yet.
 */
export function createApiV1Router(authentication?: { controller: AuthController }): Router {
  const router = Router();

  router.use("/public", Router());
  const adminRouter = Router();
  const appRouter = Router();
  if (authentication !== undefined) {
    adminRouter.use("/auth", createAdminAuthRouter(authentication.controller));
    appRouter.use("/auth", createAppAuthRouter(authentication.controller));
  }
  router.use("/admin", adminRouter);
  router.use("/app", appRouter);

  return router;
}
