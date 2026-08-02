import { InputType, type Form, type FormField } from "../../../../generated/prisma/client.js";
import { AppError } from "../../../common/errors.js";
import { isPrismaUniqueConstraintError } from "../../../common/prisma-errors.js";
import type { RecruitmentCycleService } from "../../recruitment-cycles/recruitment-cycle.service.js";
import type {
  CreateFormFieldInput,
  CreateFormInput,
  FormRepository,
  FormWithFields,
  UpdateFormFieldInput,
  UpdateFormInput,
} from "./form.types.js";

const OPTION_BASED_TYPES = new Set<InputType>([
  InputType.SELECT,
  InputType.MULTI_SELECT,
  InputType.CHECKBOX,
]);
const LENGTH_BASED_TYPES = new Set<InputType>([
  InputType.TEXT,
  InputType.TEXTAREA,
  InputType.EMAIL,
  InputType.PHONE,
]);

export type FieldDeletionResult =
  | { deletionType: "HARD_DELETE" }
  | { deletionType: "SOFT_DELETE"; field: FormField };

type FormTransaction = <T>(operation: (repository: FormRepository) => Promise<T>) => Promise<T>;

/**
 * Owns dynamic-form and field lifecycle rules (PRD §18–20.1). Fields stay
 * editable after submissions exist; there is no form locking or versioning.
 */
export class FormService {
  constructor(
    private readonly formRepository: FormRepository,
    private readonly recruitmentCycleService: RecruitmentCycleService,
    private readonly transaction: FormTransaction,
  ) {}

  async createForCycle(cycleId: string, input: CreateFormInput): Promise<Form> {
    await this.recruitmentCycleService.getById(cycleId);

    const existing = await this.formRepository.findByCycleId(cycleId);
    if (existing !== null) {
      throw new AppError("FORM_ALREADY_EXISTS", 409, "This recruitment cycle already has a form");
    }

    return this.formRepository.create(cycleId, input);
  }

  async getForCycleWithFields(cycleId: string): Promise<FormWithFields> {
    await this.recruitmentCycleService.getById(cycleId);
    const form = await this.formRepository.findByCycleIdWithFields(cycleId);
    if (form === null) {
      throw new AppError("FORM_NOT_FOUND", 404, "This recruitment cycle has no form yet");
    }
    return form;
  }

  async getByIdOrThrow(formId: string): Promise<Form> {
    const form = await this.formRepository.findById(formId);
    if (form === null) {
      throw new AppError("FORM_NOT_FOUND", 404, "Form not found");
    }
    return form;
  }

  async updateForm(formId: string, input: UpdateFormInput): Promise<Form> {
    await this.getByIdOrThrow(formId);
    return this.formRepository.update(formId, input);
  }

  async addField(formId: string, input: CreateFormFieldInput): Promise<FormField> {
    this.assertFieldRulesConsistent({
      type: input.type,
      enum: input.enum ?? null,
      minLength: input.minLength ?? null,
      maxLength: input.maxLength ?? null,
      minValue: input.minValue ?? null,
      maxValue: input.maxValue ?? null,
    });

    try {
      return await this.transaction(async (repository) => {
        const form = await repository.findById(formId);
        if (form === null) {
          throw new AppError("FORM_NOT_FOUND", 404, "Form not found");
        }
        const existingFields = await repository.findFieldsByFormId(formId);
        const nextOrder = existingFields.reduce((max, field) => Math.max(max, field.order), -1) + 1;
        return repository.createField(formId, nextOrder, input);
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError(
          "DUPLICATE_FIELD_KEY",
          409,
          "A field with this key already exists on this form",
        );
      }
      throw error;
    }
  }

  async updateField(formId: string, fieldId: string, input: UpdateFormFieldInput): Promise<FormField> {
    const existing = await this.formRepository.findFieldById(fieldId);
    if (existing === null || existing.formId !== formId) {
      throw new AppError("FORM_FIELD_NOT_FOUND", 404, "Form field not found");
    }

    this.assertFieldRulesConsistent({
      type: input.type ?? existing.type,
      enum: input.enum !== undefined ? input.enum : existing.enum,
      minLength: input.minLength !== undefined ? input.minLength : existing.minLength,
      maxLength: input.maxLength !== undefined ? input.maxLength : existing.maxLength,
      minValue: input.minValue !== undefined ? input.minValue : existing.minValue,
      maxValue: input.maxValue !== undefined ? input.maxValue : existing.maxValue,
    });

    try {
      return await this.formRepository.updateField(fieldId, input);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new AppError(
          "DUPLICATE_FIELD_KEY",
          409,
          "A field with this key already exists on this form",
        );
      }
      throw error;
    }
  }

  /**
   * Field removal is field-specific (PRD §19): a field with no submitted
   * answers is deleted permanently; a field with answers is archived.
   */
  async removeField(formId: string, fieldId: string): Promise<FieldDeletionResult> {
    return this.transaction(async (repository) => {
      const existing = await repository.findFieldById(fieldId);
      if (existing === null || existing.formId !== formId) {
        throw new AppError("FORM_FIELD_NOT_FOUND", 404, "Form field not found");
      }

      const submissionCount = await repository.countSubmissionsForField(fieldId);
      if (submissionCount === 0) {
        await repository.deleteField(fieldId);
        return { deletionType: "HARD_DELETE" };
      }

      const field = await repository.updateField(fieldId, { isActive: false });
      return { deletionType: "SOFT_DELETE", field };
    });
  }

  /**
   * Reassigns display order for every field on the form. The caller must
   * supply the complete, current set of field IDs for that form exactly
   * once each; order is unique per form so this runs as a two-phase update
   * (negative temporary values, then final ascending values) to avoid
   * transient unique-constraint collisions.
   */
  async reorderFields(formId: string, orderedFieldIds: string[]): Promise<FormField[]> {
    return this.transaction(async (repository) => {
      const form = await repository.findById(formId);
      if (form === null) {
        throw new AppError("FORM_NOT_FOUND", 404, "Form not found");
      }
      const existingFields = await repository.findFieldsByFormId(formId);
      const requestedIds = new Set(orderedFieldIds);

      if (
        orderedFieldIds.length !== existingFields.length ||
        requestedIds.size !== orderedFieldIds.length ||
        existingFields.some((field) => !requestedIds.has(field.id))
      ) {
        throw new AppError(
          "INVALID_FIELD_ORDER",
          400,
          "The reorder request must include every existing field on this form exactly once",
        );
      }

      for (const [index, fieldId] of orderedFieldIds.entries()) {
        await repository.setFieldOrder(fieldId, -(index + 1));
      }
      for (const [index, fieldId] of orderedFieldIds.entries()) {
        await repository.setFieldOrder(fieldId, index);
      }

      return repository.findFieldsByFormId(formId);
    });
  }

  /** Used by public registration and by the form itself; never exposes cycle IDs. */
  async getActiveFieldsForCycle(cycleId: string): Promise<{ form: Form; fields: FormField[] }> {
    const form = await this.formRepository.findByCycleId(cycleId);
    if (form === null) {
      throw new AppError("FORM_NOT_FOUND", 404, "There is no registration form for this cycle");
    }
    const fields = await this.formRepository.findFieldsByFormId(form.id, { activeOnly: true });
    return { form, fields };
  }

  async getPublicForm(): Promise<{ form: Form; fields: FormField[] }> {
    const activeCycle = await this.recruitmentCycleService.getActiveCycleOrThrow();
    return this.getActiveFieldsForCycle(activeCycle.id);
  }

  private assertFieldRulesConsistent(rules: {
    type: InputType;
    enum: string | null;
    minLength: number | null;
    maxLength: number | null;
    minValue: number | null;
    maxValue: number | null;
  }): void {
    if (OPTION_BASED_TYPES.has(rules.type)) {
      const options = (rules.enum ?? "").split(",").map((option) => option.trim()).filter(Boolean);
      if (options.length === 0) {
        throw new AppError(
          "MISSING_FIELD_OPTIONS",
          400,
          "SELECT, MULTI_SELECT, and CHECKBOX fields require at least one comma-separated option",
        );
      }
      if (new Set(options).size !== options.length) {
        throw new AppError("INVALID_FIELD_VALIDATION", 400, "Field options must be unique");
      }
    } else if (rules.enum !== null) {
      throw new AppError("INVALID_FIELD_VALIDATION", 400, "Only option-based fields may define options");
    }

    if (!LENGTH_BASED_TYPES.has(rules.type) && (rules.minLength !== null || rules.maxLength !== null)) {
      throw new AppError("INVALID_FIELD_VALIDATION", 400, "Length limits apply only to text-based fields");
    }
    if (rules.type !== InputType.NUMBER && (rules.minValue !== null || rules.maxValue !== null)) {
      throw new AppError("INVALID_FIELD_VALIDATION", 400, "Numeric limits apply only to NUMBER fields");
    }

    if (
      rules.minLength !== null &&
      rules.maxLength !== null &&
      rules.minLength > rules.maxLength
    ) {
      throw new AppError("INVALID_FIELD_VALIDATION", 400, "minLength cannot exceed maxLength");
    }

    if (rules.minValue !== null && rules.maxValue !== null && rules.minValue > rules.maxValue) {
      throw new AppError("INVALID_FIELD_VALIDATION", 400, "minValue cannot exceed maxValue");
    }
  }
}
