import { Router } from "express";

/**
 * Stable client namespaces. Feature routers are mounted here as their modules
 * are implemented; Phase 0 deliberately exposes no product endpoints yet.
 */
export function createApiV1Router(): Router {
  const router = Router();

  router.use("/public", Router());
  router.use("/admin", Router());
  router.use("/app", Router());

  return router;
}
