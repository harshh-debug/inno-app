import type { Environment } from "../../config/environment.js";
import {
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildRegistrationSuccessEmail,
  type EmailVerificationEmailInput,
  type PasswordResetEmailInput,
  type RegistrationSuccessEmailInput,
} from "./email-payload.js";
import { EmailQueue } from "./email-queue.js";

/** Prepares the two permitted Phase 1 email payloads and queues them. */
export class NotificationService {
  constructor(
    private readonly emailQueue: EmailQueue,
    private readonly appUrl: Environment["APP_URL"],
  ) {}

  async queueRegistrationSuccess(to: RegistrationSuccessEmailInput["to"]): Promise<void> {
    const payload = buildRegistrationSuccessEmail({ to, appUrl: this.appUrl });
    await this.emailQueue.enqueue("REGISTRATION_SUCCESS", payload);
  }

  async queueEmailVerification(input: EmailVerificationEmailInput): Promise<void> {
    const payload = buildEmailVerificationEmail(input);
    await this.emailQueue.enqueue("EMAIL_VERIFICATION", payload);
  }

  async queuePasswordReset(input: PasswordResetEmailInput): Promise<void> {
    const payload = buildPasswordResetEmail(input);
    await this.emailQueue.enqueue("PASSWORD_RESET", payload);
  }
}
