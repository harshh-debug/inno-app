import nodemailer, { type Transporter } from "nodemailer";
import type { EmailWorkerEnvironment } from "../../config/environment.js";
import type { EmailPayload } from "../../modules/notifications/email-payload.js";

/** SMTP-only delivery adapter. It receives a complete payload and changes nothing. */
export class SmtpClient {
  private readonly transporter: Transporter;

  constructor(private readonly environment: EmailWorkerEnvironment) {
    this.transporter = nodemailer.createTransport({
      host: environment.SMTP_HOST,
      port: environment.SMTP_PORT,
      secure: environment.SMTP_SECURE,
      auth:
        environment.SMTP_USER === undefined || environment.SMTP_PASSWORD === undefined
          ? undefined
          : { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD },
    });
  }

  async send(payload: EmailPayload): Promise<void> {
    await this.transporter.sendMail({ from: this.environment.SMTP_FROM, ...payload });
  }
}
