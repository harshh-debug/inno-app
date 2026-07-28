import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors.js";
import { errorHandler, notFoundHandler } from "./error.middleware.js";

function createResponseStub() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  return response;
}

describe("HTTP error middleware", () => {
  it("returns the standard not-found envelope", () => {
    const response = createResponseStub();

    notFoundHandler(
      { method: "GET", originalUrl: "/api/v1/public/registration-form" } as Request,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route GET /api/v1/public/registration-form was not found",
        details: [],
      },
    });
  });

  it("maps application errors to their stable response", () => {
    const response = createResponseStub();

    errorHandler(
      new AppError("EXAMPLE_ERROR", 409, "Example conflict"),
      {} as Request,
      response as unknown as Response,
      vi.fn(),
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "EXAMPLE_ERROR",
        message: "Example conflict",
        details: [],
      },
    });
  });
});
