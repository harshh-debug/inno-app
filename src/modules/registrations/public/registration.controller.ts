import type { Request, Response } from "express";
import { InputType } from "../../../../generated/prisma/client.js";
import type { FormService } from "../form/index.js";
import type { RegistrationService } from "../registration.service.js";
import type { SubmitRegistrationRequest } from "../registration.schemas.js";

function toPublicField(field: {
  id: string;
  key: string;
  title: string;
  helpText: string | null;
  type: InputType;
  placeholder: string | null;
  required: boolean;
  order: number;
  enum: string | null;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
}) {
  return {
    id: field.id,
    key: field.key,
    title: field.title,
    helpText: field.helpText,
    type: field.type,
    placeholder: field.placeholder,
    required: field.required,
    order: field.order,
    options:
      field.enum === null
        ? []
        : field.enum
            .split(",")
            .map((option) => option.trim())
            .filter((option) => option.length > 0),
    minLength: field.minLength,
    maxLength: field.maxLength,
    minValue: field.minValue,
    maxValue: field.maxValue,
  };
}

/** Anonymous public registration HTTP adapter. No cycle ID ever reaches this client. */
export class PublicRegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly formService: FormService,
  ) {}

  getPublicForm = async (_request: Request, response: Response): Promise<void> => {
    const { form, fields } = await this.formService.getPublicForm();
    response.json({
      data: {
        title: form.title,
        description: form.description,
        submitButtonLabel: form.submitButtonLabel,
        fields: fields.map(toPublicField),
      },
    });
  };

  submit = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as SubmitRegistrationRequest;
    const result = await this.registrationService.submitPublicRegistration(body);
    response.status(201).json({ data: result });
  };
}
