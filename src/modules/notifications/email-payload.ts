export const EMAIL_JOB_TYPES = ["REGISTRATION_SUCCESS", "EMAIL_VERIFICATION"] as const;

export type EmailJobType = (typeof EMAIL_JOB_TYPES)[number];

/** Complete delivery data. The worker sends these values without product logic. */
export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface QueuedEmailJob {
  type: EmailJobType;
  payload: EmailPayload;
}

export interface RegistrationSuccessEmailInput {
  to: string;
  appUrl: string;
}

export interface EmailVerificationEmailInput {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export function buildRegistrationSuccessEmail(input: RegistrationSuccessEmailInput): EmailPayload {
  return {
    to: input.to,
    subject: "Your Innogeeks registration is confirmed",
    text: [
      "Your Innogeeks registration has been completed successfully.",
      "You can now use the Innogeeks app to continue with recruitment updates.",
      `Open the app: ${input.appUrl}`,
    ].join("\n\n"),
    html: [
      "<p>Your Innogeeks registration has been completed successfully.</p>",
      "<p>You can now use the Innogeeks app to continue with recruitment updates.</p>",
      `<p><a href=\"${escapeHtmlAttribute(input.appUrl)}\">Open the app</a></p>`,
    ].join(""),
  };
}

export function buildEmailVerificationEmail(input: EmailVerificationEmailInput): EmailPayload {
  return {
    to: input.to,
    subject: "Your Innogeeks verification code",
    text: [
      "Use this code to set up your Innogeeks app password:",
      input.code,
      `This code expires in ${input.expiresInMinutes} minutes. Do not share it with anyone.`,
    ].join("\n\n"),
    html: [
      "<p>Use this code to set up your Innogeeks app password:</p>",
      `<p><strong>${escapeHtmlText(input.code)}</strong></p>`,
      `<p>This code expires in ${input.expiresInMinutes} minutes. Do not share it with anyone.</p>`,
    ].join(""),
  };
}

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '\"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value);
}
