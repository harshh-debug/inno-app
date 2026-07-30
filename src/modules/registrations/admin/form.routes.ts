import { Router, type RequestHandler } from "express";
import { validateRequest } from "../../../common/validation/validate-request.js";
import type { FormController } from "./form.controller.js";
import {
  createFieldSchema,
  createFormSchema,
  deleteFieldSchema,
  getFormForCycleSchema,
  reorderFieldsSchema,
  updateFieldSchema,
  updateFormSchema,
} from "../form/form.schemas.js";

/**
 * Mounted at the /api/v1/admin root (not nested) because its routes span
 * two path families: /recruitment-cycles/:cycleId/form and /forms/:formId/*.
 */
export function createAdminFormRouter(
  controller: FormController,
  adminGuard: RequestHandler[],
): Router {
  const router = Router();
  router.use(...adminGuard);

  router.post(
    "/recruitment-cycles/:cycleId/form",
    validateRequest(createFormSchema),
    controller.createForCycle,
  );
  router.get(
    "/recruitment-cycles/:cycleId/form",
    validateRequest(getFormForCycleSchema),
    controller.getForCycle,
  );

  router.patch("/forms/:formId", validateRequest(updateFormSchema), controller.updateForm);
  router.post("/forms/:formId/fields", validateRequest(createFieldSchema), controller.addField);
  router.patch(
    "/forms/:formId/fields/:fieldId",
    validateRequest(updateFieldSchema),
    controller.updateField,
  );
  router.delete(
    "/forms/:formId/fields/:fieldId",
    validateRequest(deleteFieldSchema),
    controller.removeField,
  );
  router.put(
    "/forms/:formId/fields/order",
    validateRequest(reorderFieldsSchema),
    controller.reorderFields,
  );

  return router;
}
