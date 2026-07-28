import type { Request, Response } from "express";
import type { AuthService } from "./auth.service.js";
import type {
  AdminLoginRequest,
  AppEmailRequest,
  AppLoginRequest,
  SetPasswordRequest,
  VerifyCodeRequest,
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
}
