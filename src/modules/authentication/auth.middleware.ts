import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthService } from "./auth.service.js";
import type { AccessTokenService } from "./token.js";

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: string };
}

export function authenticateAccessToken(tokens: AccessTokenService): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");
    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      next(new AppError("UNAUTHORIZED", 401, "A bearer token is required"));
      return;
    }
    try {
      request.auth = await tokens.verify(authorization.slice("Bearer ".length));
      next();
    } catch {
      next(new AppError("UNAUTHORIZED", 401, "Access token is invalid or expired"));
    }
  };
}

export function requireAdmin(authService: AuthService): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    if (request.auth === undefined) {
      next(new AppError("UNAUTHORIZED", 401, "A bearer token is required"));
      return;
    }
    try {
      await authService.requireActiveAdmin(request.auth.userId);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAppStudent(authService: AuthService): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    if (request.auth === undefined) {
      next(new AppError("UNAUTHORIZED", 401, "A bearer token is required"));
      return;
    }
    try {
      await authService.requireEligibleAppStudent(request.auth.userId);
      next();
    } catch (error) {
      next(error);
    }
  };
}
