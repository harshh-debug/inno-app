import type { Form, FormField, InputType } from "../../../../generated/prisma/client.js";

export interface CreateFormInput {
  title?: string;
  description?: string | null;
  submitButtonLabel?: string;
}

export interface UpdateFormInput {
  title?: string;
  description?: string | null;
  submitButtonLabel?: string;
}

export interface CreateFormFieldInput {
  key: string;
  title: string;
  helpText?: string | null;
  type: InputType;
  placeholder?: string | null;
  required?: boolean;
  enum?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
}

export interface UpdateFormFieldInput {
  key?: string;
  title?: string;
  helpText?: string | null;
  type?: InputType;
  placeholder?: string | null;
  required?: boolean;
  isActive?: boolean;
  enum?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
}

export type FormWithFields = Form & { fields: FormField[] };

export interface FormRepository {
  findByCycleId(cycleId: string): Promise<Form | null>;
  findByCycleIdWithFields(cycleId: string): Promise<FormWithFields | null>;
  findById(formId: string): Promise<Form | null>;
  findByIdWithFields(formId: string): Promise<FormWithFields | null>;
  create(cycleId: string, input: CreateFormInput): Promise<Form>;
  update(formId: string, input: UpdateFormInput): Promise<Form>;

  findFieldById(fieldId: string): Promise<FormField | null>;
  findFieldsByFormId(formId: string, options?: { activeOnly?: boolean }): Promise<FormField[]>;
  countSubmissionsForField(fieldId: string): Promise<number>;
  createField(formId: string, order: number, input: CreateFormFieldInput): Promise<FormField>;
  updateField(fieldId: string, input: UpdateFormFieldInput): Promise<FormField>;
  deleteField(fieldId: string): Promise<void>;
  setFieldOrder(fieldId: string, order: number): Promise<void>;
}
