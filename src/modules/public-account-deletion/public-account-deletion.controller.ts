import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../../common/errors.js";
import type { PublicAccountDeletionService } from "./public-account-deletion.service.js";
import {
  renderDeleteAccountConfirmedPage,
  renderDeleteAccountErrorPage,
  renderDeleteAccountFormPage,
  renderDeleteAccountRequestedPage,
  renderPrivacyPolicyPage,
  renderValidationErrorPage,
} from "./public-account-deletion.templates.js";

const emailBodySchema = z.object({ collegeEmail: z.email().max(320) });
const confirmQuerySchema = z.object({ email: z.email().max(320), token: z.string().min(20) });

// Plain HTML form endpoints, not the /api/v1 JSON API — a human clicks
// through these directly (including from an emailed link and, eventually,
// the Play Console data-safety "deletion URL" field), so responses are
// rendered pages, not JSON envelopes, and validation failures render an
// HTML error page instead of going through the shared JSON validateRequest
// middleware.
export class PublicAccountDeletionController {
  constructor(private readonly service: PublicAccountDeletionService) {}

  showForm = (_request: Request, response: Response): void => {
    response.type("html").send(renderDeleteAccountFormPage());
  };

  showPrivacyPolicy = (_request: Request, response: Response): void => {
    response.type("html").send(renderPrivacyPolicyPage());
  };

  submitRequest = async (request: Request, response: Response): Promise<void> => {
    const parsed = emailBodySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).type("html").send(renderValidationErrorPage());
      return;
    }
    await this.service.requestDeletion(parsed.data.collegeEmail);
    response.type("html").send(renderDeleteAccountRequestedPage());
  };

  confirm = async (request: Request, response: Response): Promise<void> => {
    const parsed = confirmQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).type("html").send(renderDeleteAccountErrorPage("This deletion link is invalid or has expired"));
      return;
    }
    try {
      const { scheduledFor } = await this.service.confirmDeletion(parsed.data.email, parsed.data.token);
      response.type("html").send(renderDeleteAccountConfirmedPage(scheduledFor));
    } catch (error) {
      if (error instanceof AppError) {
        response.status(error.httpStatus).type("html").send(renderDeleteAccountErrorPage(error.message));
        return;
      }
      throw error;
    }
  };
}
