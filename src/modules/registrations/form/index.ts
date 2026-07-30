/**
 * Dynamic registration-form definitions and validation.
 *
 * Fields remain editable throughout recruitment. `isActive = false` archives a
 * field with submitted answers; unused fields may be permanently deleted.
 */
export { FormService } from "./form.service.js";
export type { FieldDeletionResult } from "./form.service.js";
export { PrismaFormRepository } from "./form.repository.js";
export { validateAndNormalizeAnswer } from "./answer-validation.js";
export type { FieldValidationRules } from "./answer-validation.js";
export type {
  CreateFormFieldInput,
  CreateFormInput,
  FormRepository,
  FormWithFields,
  UpdateFormFieldInput,
  UpdateFormInput,
} from "./form.types.js";
export {
  createFieldSchema,
  createFormSchema,
  deleteFieldSchema,
  getFormForCycleSchema,
  reorderFieldsSchema,
  updateFieldSchema,
  updateFormSchema,
} from "./form.schemas.js";
