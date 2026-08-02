import type { Request, Response } from "express";
import type { FormService } from "../form/form.service.js";
import type {
  CreateFieldRequest,
  CreateFormRequest,
  ReorderFieldsRequest,
  UpdateFieldRequest,
  UpdateFormRequest,
} from "../form/form.schemas.js";

export class FormController {
  constructor(private readonly formService: FormService) {}

  createForCycle = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const body = request.body as CreateFormRequest;
    const form = await this.formService.createForCycle(cycleId, body);
    response.status(201).json({ data: form });
  };

  getForCycle = async (request: Request, response: Response): Promise<void> => {
    const { cycleId } = request.params as { cycleId: string };
    const form = await this.formService.getForCycleWithFields(cycleId);
    response.json({ data: form });
  };

  updateForm = async (request: Request, response: Response): Promise<void> => {
    const { formId } = request.params as { formId: string };
    const body = request.body as UpdateFormRequest;
    const form = await this.formService.updateForm(formId, body);
    response.json({ data: form });
  };

  addField = async (request: Request, response: Response): Promise<void> => {
    const { formId } = request.params as { formId: string };
    const body = request.body as CreateFieldRequest;
    const field = await this.formService.addField(formId, body);
    response.status(201).json({ data: field });
  };

  updateField = async (request: Request, response: Response): Promise<void> => {
    const { formId, fieldId } = request.params as { formId: string; fieldId: string };
    const body = request.body as UpdateFieldRequest;
    const field = await this.formService.updateField(formId, fieldId, body);
    response.json({ data: field });
  };

  removeField = async (request: Request, response: Response): Promise<void> => {
    const { formId, fieldId } = request.params as { formId: string; fieldId: string };
    const result = await this.formService.removeField(formId, fieldId);
    response.json({ data: result });
  };

  reorderFields = async (request: Request, response: Response): Promise<void> => {
    const { formId } = request.params as { formId: string };
    const body = request.body as ReorderFieldsRequest;
    const fields = await this.formService.reorderFields(formId, body.fieldIds);
    response.json({ data: fields });
  };
}
