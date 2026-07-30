import { z } from "zod";
import { InputType } from "../../../../generated/prisma/client.js";

const cycleIdParams = z.object({ cycleId: z.uuid() });
const formIdParams = z.object({ formId: z.uuid() });
const fieldIdParams = z.object({ formId: z.uuid(), fieldId: z.uuid() });

const inputType = z.enum(InputType);
const fieldKey = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_]*$/, "key must be lower_snake_case starting with a letter");

export const createFormSchema = z.object({
  params: cycleIdParams,
  body: z
    .object({
      title: z.string().trim().min(1).max(300).optional(),
      description: z.string().trim().max(5000).nullable().optional(),
      submitButtonLabel: z.string().trim().min(1).max(100).optional(),
    })
    .optional()
    .default({}),
});

export const getFormForCycleSchema = z.object({ params: cycleIdParams });

export const updateFormSchema = z.object({
  params: formIdParams,
  body: z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    submitButtonLabel: z.string().trim().min(1).max(100).optional(),
  }),
});

export const createFieldSchema = z.object({
  params: formIdParams,
  body: z.object({
    key: fieldKey,
    title: z.string().trim().min(1).max(200),
    helpText: z.string().trim().max(2000).nullable().optional(),
    type: inputType,
    placeholder: z.string().trim().max(300).nullable().optional(),
    required: z.boolean().optional(),
    enum: z.string().trim().max(5000).nullable().optional(),
    minLength: z.number().int().min(0).nullable().optional(),
    maxLength: z.number().int().min(0).nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
  }),
});

export const updateFieldSchema = z.object({
  params: fieldIdParams,
  body: z.object({
    key: fieldKey.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    helpText: z.string().trim().max(2000).nullable().optional(),
    type: inputType.optional(),
    placeholder: z.string().trim().max(300).nullable().optional(),
    required: z.boolean().optional(),
    isActive: z.boolean().optional(),
    enum: z.string().trim().max(5000).nullable().optional(),
    minLength: z.number().int().min(0).nullable().optional(),
    maxLength: z.number().int().min(0).nullable().optional(),
    minValue: z.number().nullable().optional(),
    maxValue: z.number().nullable().optional(),
  }),
});

export const deleteFieldSchema = z.object({ params: fieldIdParams });

export const reorderFieldsSchema = z.object({
  params: formIdParams,
  body: z.object({ fieldIds: z.array(z.uuid()).min(1) }),
});

export type CreateFormRequest = z.infer<typeof createFormSchema>["body"];
export type UpdateFormRequest = z.infer<typeof updateFormSchema>["body"];
export type CreateFieldRequest = z.infer<typeof createFieldSchema>["body"];
export type UpdateFieldRequest = z.infer<typeof updateFieldSchema>["body"];
export type ReorderFieldsRequest = z.infer<typeof reorderFieldsSchema>["body"];
