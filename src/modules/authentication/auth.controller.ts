import type { Request, Response } from "express";
import { AppError } from "../../common/errors.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import type {
  AdminLoginRequest,
  AppEmailRequest,
  AppLoginRequest,
  CompletePasswordResetRequest,
  RequestPasswordResetRequest,
  SetPasswordRequest,
  VerifyCodeRequest,
  VerifyPasswordResetCodeRequest,
} from "./auth.schemas.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  adminLogin = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as AdminLoginRequest;
    response.json({ data: await this.authService.loginAdmin(body.collegeEmail, body.password) });
  };

  emailGate = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as AppEmailRequest;
    response.json({ data: await this.authService.emailGate(body.collegeEmail) });
  };

  requestVerificationCode = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as AppEmailRequest;
    await this.authService.requestEmailVerification(body.collegeEmail);
    response.status(202).json({ data: { requested: true } });
  };

  verifyCode = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as VerifyCodeRequest;
    response.json({ data: await this.authService.verifyEmailCode(body.collegeEmail, body.code) });
  };

  setPassword = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as SetPasswordRequest;
    response.json({ data: await this.authService.setPassword(body.passwordSetupToken, body.password) });
  };

  appLogin = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as AppLoginRequest;
    response.json({ data: await this.authService.loginApp(body.collegeEmail, body.password) });
  };

  // Gap 1 — password reset
  requestPasswordReset = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as RequestPasswordResetRequest;
    await this.authService.requestPasswordReset(body.collegeEmail);
    response.status(202).json({ data: { requested: true } });
  };

  verifyPasswordResetCode = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as VerifyPasswordResetCodeRequest;
    response.json({ data: await this.authService.verifyPasswordResetCode(body.collegeEmail, body.code) });
  };

  completePasswordReset = async (request: Request, response: Response): Promise<void> => {
    const body = request.body as CompletePasswordResetRequest;
    response.json({ data: await this.authService.completePasswordReset(body.passwordResetToken, body.password) });
  };

  // Gap 5 — logout
  logout = async (request: AuthenticatedRequest, response: Response): Promise<void> => {
    if (request.auth === undefined) {
      throw new AppError("UNAUTHORIZED", 401, "A bearer token is required");
    }
    await this.authService.logout(request.auth);
    response.json({ data: { loggedOut: true } });
  };
}
