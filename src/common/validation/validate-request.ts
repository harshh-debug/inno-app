import type { RequestHandler } from "express";
import { z } from "zod";

export interface RequestValidationInput {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}

/** Validates and replaces request parts with their parsed Zod values. */
export function validateRequest(schema: z.ZodType<RequestValidationInput>): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    if (parsed.data.body !== undefined) {
      request.body = parsed.data.body;
    }

    next();
  };
}
