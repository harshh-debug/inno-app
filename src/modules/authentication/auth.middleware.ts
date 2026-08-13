import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthService } from "./auth.service.js";
import type { AccessTokenService, VerifiedAccessTokenClaims } from "./token.js";
import type { TokenDenylist } from "./token-denylist.js";

export interface AuthenticatedRequest extends Request {
  auth?: VerifiedAccessTokenClaims;
}

/**
 * `denylist` is optional so existing composition (tests, partial app wiring)
 * keeps working without Redis. When supplied, a token revoked by
 * `POST /app/auth/logout` is rejected with the same 401 UNAUTHORIZED used for
 * an expired or malformed token — logout does not get a different error
 * shape than any other "your session is over" case (see gap 4 resolution).
 */
export function authenticateAccessToken(
  tokens: AccessTokenService,
  denylist?: TokenDenylist,
): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");
    if (authorization === undefined || !authorization.startsWith("Bearer ")) {
      next(new AppError("UNAUTHORIZED", 401, "A bearer token is required"));
      return;
    }
    try {
      const claims = await tokens.verify(authorization.slice("Bearer ".length));
      if (denylist !== undefined && (await denylist.isRevoked(claims.jti))) {
        next(new AppError("UNAUTHORIZED", 401, "Access token is invalid or expired"));
        return;
      }
      request.auth = claims;
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
