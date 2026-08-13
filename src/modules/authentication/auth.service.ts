import { PlatformRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors.js";
import type { Environment } from "../../config/environment.js";
import type { NotificationService } from "../notifications/notification.service.js";
import { normalizeEmail } from "../users/email.js";
import { hashPassword, verifyPassword } from "./password.js";
import { AuthRepository } from "./auth.repository.js";
import { AccessTokenService, type VerifiedAccessTokenClaims } from "./token.js";
import type { TokenDenylist } from "./token-denylist.js";
import { generateNumericCode, generateOpaqueToken, hashVerificationValue } from "./verification-secret.js";

const CODE_EXPIRY_MS = 10 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;
const SETUP_TOKEN_EXPIRY_MS = 10 * 60 * 1_000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly notifications: NotificationService,
    private readonly tokens: AccessTokenService,
    private readonly verificationHashSecret: Environment["VERIFICATION_HASH_SECRET"],
    private readonly transaction: <T>(operation: (repository: AuthRepository) => Promise<T>) => Promise<T>,
    private readonly denylist?: TokenDenylist,
  ) {}

  async loginAdmin(collegeEmail: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.repository.findUserByNormalizedEmail(normalizeEmail(collegeEmail));
    if (user === null || user.role !== PlatformRole.ADMIN || user.isSuspended || user.passwordHash === null) {
      throw this.invalidCredentials();
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw this.invalidCredentials();
    }
    return { accessToken: await this.tokens.create({ userId: user.id, role: user.role }) };
  }

  async emailGate(collegeEmail: string): Promise<{ nextStep: "PASSWORD_SETUP" | "PASSWORD_LOGIN" }> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    return { nextStep: user.passwordHash === null ? "PASSWORD_SETUP" : "PASSWORD_LOGIN" };
  }

  async requestEmailVerification(collegeEmail: string): Promise<void> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    if (user.passwordHash !== null) {
      throw new AppError("PASSWORD_ALREADY_SET", 409, "Password setup is already complete");
    }

    const now = new Date();
    const latest = await this.repository.findLatestEmailVerification(user.id);
    if (
      latest !== null &&
      latest.usedAt === null &&
      latest.invalidatedAt === null &&
      latest.resendAvailableAt > now
    ) {
      throw new AppError("VERIFICATION_CODE_COOLDOWN", 429, "Please wait before requesting another verification code");
    }

    const code = generateNumericCode(6);
    const verification = await this.transaction(async (repository) => {
      await repository.invalidatePendingEmailVerification(user.id, now);
      return repository.createEmailVerification({
        userId: user.id,
        normalizedEmail: user.normalizedEmail,
        codeHash: hashVerificationValue(code, this.verificationHashSecret),
        expiresAt: new Date(now.getTime() + CODE_EXPIRY_MS),
        resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      });
    });

    try {
      await this.notifications.queueEmailVerification({ to: user.collegeEmail, code, expiresInMinutes: 10 });
    } catch (error) {
      await this.repository.invalidateCode(verification.id, new Date());
      throw new AppError("EMAIL_QUEUE_UNAVAILABLE", 503, "Unable to send a verification code", { cause: error });
    }
  }

  async verifyEmailCode(collegeEmail: string, code: string): Promise<{ passwordSetupToken: string }> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    if (user.passwordHash !== null) {
      throw new AppError("PASSWORD_ALREADY_SET", 409, "Password setup is already complete");
    }
    const verification = await this.repository.findLatestEmailVerification(user.id);
    const now = new Date();
    if (
      verification === null ||
      verification.usedAt !== null ||
      verification.invalidatedAt !== null ||
      verification.expiresAt <= now
    ) {
      throw new AppError("VERIFICATION_CODE_INVALID", 400, "Verification code is invalid or expired");
    }
    if (verification.codeHash !== hashVerificationValue(code, this.verificationHashSecret)) {
      await this.repository.incrementFailedAttempt(verification, now);
      throw new AppError("VERIFICATION_CODE_INVALID", 400, "Verification code is invalid or expired");
    }

    const passwordSetupToken = generateOpaqueToken(32);
    const marked = await this.repository.markCodeVerified({
      codeId: verification.id,
      now,
      actionTokenHash: hashVerificationValue(passwordSetupToken, this.verificationHashSecret),
      actionTokenExpiresAt: new Date(now.getTime() + SETUP_TOKEN_EXPIRY_MS),
    });
    if (marked.count !== 1) {
      throw new AppError("VERIFICATION_CODE_INVALID", 400, "Verification code is invalid or expired");
    }
    return { passwordSetupToken };
  }

  async setPassword(passwordSetupToken: string, password: string): Promise<{ accessToken: string }> {
    const now = new Date();
    const passwordHash = await hashPassword(password);
    const updatedUser = await this.transaction(async (repository) => {
      const code = await repository.findActionToken(hashVerificationValue(passwordSetupToken, this.verificationHashSecret));
      if (code === null || code.actionTokenUsedAt !== null || code.actionTokenExpiresAt === null || code.actionTokenExpiresAt <= now) {
        throw new AppError("PASSWORD_SETUP_TOKEN_INVALID", 400, "Password setup authorization is invalid or expired");
      }
      const user = await repository.findEligibleStudentById(code.userId);
      if (user === null || user.passwordHash !== null) {
        throw new AppError("PASSWORD_SETUP_NOT_ALLOWED", 403, "Password setup is no longer allowed");
      }
      const consumed = await repository.consumeActionToken(code.id, now);
      if (consumed.count !== 1) {
        throw new AppError("PASSWORD_SETUP_TOKEN_INVALID", 400, "Password setup authorization is invalid or expired");
      }
      return repository.setStudentPassword(user.id, passwordHash, now);
    });
    return { accessToken: await this.tokens.create({ userId: updatedUser.id, role: updatedUser.role }) };
  }

  async loginApp(collegeEmail: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    if (user.passwordHash === null || !(await verifyPassword(password, user.passwordHash))) {
      throw this.invalidCredentials();
    }
    return { accessToken: await this.tokens.create({ userId: user.id, role: user.role }) };
  }

  // Gap 1 — password reset. Same eligibility gate and code/token machinery
  // as first-login setup, kept as separate methods (rather than parameterizing
  // the existing ones) so the two flows fail closed independently: a code or
  // token minted for one can never be accepted by the other.

  async requestPasswordReset(collegeEmail: string): Promise<void> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    if (user.passwordHash === null) {
      // No password exists yet — this student hasn't finished first-login
      // setup, so "reset" isn't the right flow. Point them back at it instead
      // of silently accepting a request that would never be actionable.
      throw new AppError(
        "PASSWORD_NOT_SET",
        409,
        "No password has been set yet; use first-login verification instead",
      );
    }

    const now = new Date();
    const latest = await this.repository.findLatestPasswordReset(user.id);
    if (
      latest !== null &&
      latest.usedAt === null &&
      latest.invalidatedAt === null &&
      latest.resendAvailableAt > now
    ) {
      throw new AppError(
        "PASSWORD_RESET_COOLDOWN",
        429,
        "Please wait before requesting another password reset code",
      );
    }

    const code = generateNumericCode(6);
    const reset = await this.transaction(async (repository) => {
      await repository.invalidatePendingPasswordReset(user.id, now);
      return repository.createPasswordReset({
        userId: user.id,
        normalizedEmail: user.normalizedEmail,
        codeHash: hashVerificationValue(code, this.verificationHashSecret),
        expiresAt: new Date(now.getTime() + CODE_EXPIRY_MS),
        resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      });
    });

    try {
      await this.notifications.queuePasswordReset({ to: user.collegeEmail, code, expiresInMinutes: 10 });
    } catch (error) {
      await this.repository.invalidateCode(reset.id, new Date());
      throw new AppError("EMAIL_QUEUE_UNAVAILABLE", 503, "Unable to send a password reset code", { cause: error });
    }
  }

  async verifyPasswordResetCode(collegeEmail: string, code: string): Promise<{ passwordResetToken: string }> {
    const user = await this.requireEligibleStudentByEmail(collegeEmail);
    if (user.passwordHash === null) {
      throw new AppError(
        "PASSWORD_NOT_SET",
        409,
        "No password has been set yet; use first-login verification instead",
      );
    }
    const reset = await this.repository.findLatestPasswordReset(user.id);
    const now = new Date();
    if (reset === null || reset.usedAt !== null || reset.invalidatedAt !== null || reset.expiresAt <= now) {
      throw new AppError("PASSWORD_RESET_CODE_INVALID", 400, "Password reset code is invalid or expired");
    }
    if (reset.codeHash !== hashVerificationValue(code, this.verificationHashSecret)) {
      await this.repository.incrementFailedAttempt(reset, now);
      throw new AppError("PASSWORD_RESET_CODE_INVALID", 400, "Password reset code is invalid or expired");
    }

    const passwordResetToken = generateOpaqueToken(32);
    const marked = await this.repository.markCodeVerified({
      codeId: reset.id,
      now,
      actionTokenHash: hashVerificationValue(passwordResetToken, this.verificationHashSecret),
      actionTokenExpiresAt: new Date(now.getTime() + SETUP_TOKEN_EXPIRY_MS),
    });
    if (marked.count !== 1) {
      throw new AppError("PASSWORD_RESET_CODE_INVALID", 400, "Password reset code is invalid or expired");
    }
    return { passwordResetToken };
  }

  async completePasswordReset(passwordResetToken: string, password: string): Promise<{ accessToken: string }> {
    const now = new Date();
    const passwordHash = await hashPassword(password);
    const updatedUser = await this.transaction(async (repository) => {
      const token = await repository.findActionToken(hashVerificationValue(passwordResetToken, this.verificationHashSecret));
      if (token === null || token.actionTokenUsedAt !== null || token.actionTokenExpiresAt === null || token.actionTokenExpiresAt <= now) {
        throw new AppError("PASSWORD_RESET_TOKEN_INVALID", 400, "Password reset authorization is invalid or expired");
      }
      // Recheck eligibility at completion, not just at request time — a
      // student suspended or unpaid mid-flow should not be able to finish
      // setting a new password (same principle as §8's setPassword recheck).
      const user = await repository.findEligibleStudentById(token.userId);
      if (user === null) {
        throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
      }
      const consumed = await repository.consumeActionToken(token.id, now);
      if (consumed.count !== 1) {
        throw new AppError("PASSWORD_RESET_TOKEN_INVALID", 400, "Password reset authorization is invalid or expired");
      }
      return repository.setStudentPassword(user.id, passwordHash, now);
    });
    return { accessToken: await this.tokens.create({ userId: updatedUser.id, role: updatedUser.role }) };
  }

  // Gap 5 — logout. Access tokens are stateless JWTs, so this cannot delete
  // the token; it denylists the token's `jti` for the remainder of its own
  // 7-day life. See TokenDenylist for why this needs no cleanup job.
  async logout(claims: VerifiedAccessTokenClaims): Promise<void> {
    if (this.denylist === undefined) {
      throw new AppError("LOGOUT_UNAVAILABLE", 503, "Logout is temporarily unavailable");
    }
    await this.denylist.revoke(claims.jti, claims.expiresAt);
  }

  async requireActiveAdmin(userId: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (user === null || user.role !== PlatformRole.ADMIN || user.isSuspended) {
      throw new AppError("FORBIDDEN", 403, "Admin access is required");
    }
  }

  async requireEligibleAppStudent(userId: string): Promise<void> {
    if ((await this.repository.findEligibleStudentById(userId)) === null) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
  }

  private async requireEligibleStudentByEmail(collegeEmail: string) {
    const user = await this.repository.findEligibleStudentByNormalizedEmail(normalizeEmail(collegeEmail));
    if (user === null) {
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
    return user;
  }

  private invalidCredentials(): AppError {
    return new AppError("INVALID_CREDENTIALS", 401, "Invalid email or password");
  }
}
