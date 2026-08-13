import { Router, type RequestHandler } from "express";
import type { AppProfileController } from "./app-profile.controller.js";

export function createAppProfileRouter(controller: AppProfileController, guard: RequestHandler[]): Router {
  const router = Router();
  router.get("/me", guard, controller.getMe);
  router.get("/recruitment", guard, controller.getRecruitment);
  return router;
}
