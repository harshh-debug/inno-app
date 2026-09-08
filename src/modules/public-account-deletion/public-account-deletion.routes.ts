import { Router } from "express";
import type { PublicAccountDeletionController } from "./public-account-deletion.controller.js";

/** Mounted at the app root (not under /api/v1) — these are human-facing pages, not the JSON API. */
export function createPublicAccountDeletionRouter(controller: PublicAccountDeletionController): Router {
  const router = Router();
  router.get("/delete-account", controller.showForm);
  router.post("/delete-account", controller.submitRequest);
  router.get("/delete-account/confirm", controller.confirm);
  router.get("/privacy", controller.showPrivacyPolicy);
  return router;
}
