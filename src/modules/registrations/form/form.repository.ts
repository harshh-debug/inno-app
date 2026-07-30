import type {
  Form,
  FormField,
  Prisma,
  PrismaClient,
} from "../../../../generated/prisma/client.js";
import type {
  CreateFormFieldInput,
  CreateFormInput,
  FormRepository,
  FormWithFields,
  UpdateFormFieldInput,
  UpdateFormInput,
} from "./form.types.js";

type FormDatabaseClient = PrismaClient | Prisma.TransactionClient;

/** Prisma access for the dynamic registration form and its fields. */
export class PrismaFormRepository implements FormRepository {
  constructor(private readonly prisma: FormDatabaseClient) {}

  findByCycleId = (cycleId: string): Promise<Form | null> => {
    return this.prisma.form.findUnique({ where: { recruitmentCycleId: cycleId } });
  };

  findByCycleIdWithFields = (cycleId: string): Promise<FormWithFields | null> => {
    return this.prisma.form.findUnique({
      where: { recruitmentCycleId: cycleId },
      include: { fields: { orderBy: { order: "asc" } } },
    });
  };

  findById = (formId: string): Promise<Form | null> => {
    return this.prisma.form.findUnique({ where: { id: formId } });
  };

  findByIdWithFields = (formId: string): Promise<FormWithFields | null> => {
    return this.prisma.form.findUnique({
      where: { id: formId },
      include: { fields: { orderBy: { order: "asc" } } },
    });
  };

  create = (cycleId: string, input: CreateFormInput): Promise<Form> => {
    return this.prisma.form.create({
      data: {
        recruitmentCycleId: cycleId,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.submitButtonLabel !== undefined
          ? { submitButtonLabel: input.submitButtonLabel }
          : {}),
      },
    });
  };

  update = (formId: string, input: UpdateFormInput): Promise<Form> => {
    return this.prisma.form.update({ where: { id: formId }, data: input });
  };

  findFieldById = (fieldId: string): Promise<FormField | null> => {
    return this.prisma.formField.findUnique({ where: { id: fieldId } });
  };

  findFieldsByFormId = (
    formId: string,
    options?: { activeOnly?: boolean },
  ): Promise<FormField[]> => {
    return this.prisma.formField.findMany({
      where: { formId, ...(options?.activeOnly === true ? { isActive: true } : {}) },
      orderBy: { order: "asc" },
    });
  };

  countSubmissionsForField = (fieldId: string): Promise<number> => {
    return this.prisma.formInputSubmission.count({ where: { fieldId } });
  };

  createField = (
    formId: string,
    order: number,
    input: CreateFormFieldInput,
  ): Promise<FormField> => {
    return this.prisma.formField.create({
      data: {
        formId,
        order,
        key: input.key,
        title: input.title,
        helpText: input.helpText ?? null,
        type: input.type,
        placeholder: input.placeholder ?? null,
        required: input.required ?? false,
        enum: input.enum ?? null,
        minLength: input.minLength ?? null,
        maxLength: input.maxLength ?? null,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
      },
    });
  };

  updateField = (fieldId: string, input: UpdateFormFieldInput): Promise<FormField> => {
    return this.prisma.formField.update({ where: { id: fieldId }, data: input });
  };

  deleteField = async (fieldId: string): Promise<void> => {
    await this.prisma.formField.delete({ where: { id: fieldId } });
  };

  setFieldOrder = async (fieldId: string, order: number): Promise<void> => {
    await this.prisma.formField.update({ where: { id: fieldId }, data: { order } });
  };
}
