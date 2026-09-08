import { AppError } from "../../common/errors.js";
import { scheduledDeletionDate } from "../app-profile/account-deletion.constants.js";
import { generateOpaqueToken, hashVerificationValue } from "../authentication/verification-secret.js";
import { normalizeEmail } from "../users/email.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { PublicAccountDeletionRepository } from "./public-account-deletion.repository.js";

const TOKEN_EXPIRY_MS = 15 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;

export class PublicAccountDeletionService {
  constructor(
    private readonly repository: PublicAccountDeletionRepository,
    private readonly notifications: NotificationService,
    private readonly verificationHashSecret: string,
    private readonly appUrl: string,
  ) {}

  // Always resolves the same way regardless of whether the email matches an
  // account — this is a public, unauthenticated form, so it must not let a
  // caller learn which college emails have accounts.
  async requestDeletion(collegeEmail: string): Promise<void> {
    const normalizedEmail = normalizeEmail(collegeEmail);
    const user = await this.repository.findDeletableUserByNormalizedEmail(normalizedEmail);
    if (user === null) {
      return;
    }

    const now = new Date();
    const latest = await this.repository.findLatestPending(user.id);
    if (latest !== null && latest.resendAvailableAt > now) {
      // Silently drop the resend rather than error — the caller can't tell
      // an account exists at all, so it also can't be told "cooldown active".
      return;
    }

    await this.repository.invalidatePending(user.id, now);
    const token = generateOpaqueToken(32);
    await this.repository.createRequest({
      userId: user.id,
      normalizedEmail,
      codeHash: hashVerificationValue(token, this.verificationHashSecret),
      expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
      resendAvailableAt: new Date(now.getTime() + RESEND_COOLDOWN_MS),
    });

    const confirmUrl = `${this.appUrl}/delete-account/confirm?email=${encodeURIComponent(collegeEmail)}&token=${encodeURIComponent(token)}`;
    await this.notifications.queueAccountDeletionLink({
      to: user.collegeEmail,
      confirmUrl,
      expiresInMinutes: TOKEN_EXPIRY_MS / 60_000,
    });
  }

  // Unlike the request step, confirmation is allowed to fail visibly — the
  // caller already holds a token, which is proof enough to explain why.
  async confirmDeletion(collegeEmail: string, token: string): Promise<{ scheduledFor: Date }> {
    const normalizedEmail = normalizeEmail(collegeEmail);
    const now = new Date();
    const codeHash = hashVerificationValue(token, this.verificationHashSecret);
    const live = await this.repository.findLive(normalizedEmail, codeHash, now);
    if (live === null) {
      throw new AppError("ACCOUNT_DELETION_LINK_INVALID", 400, "This deletion link is invalid or has expired");
    }

    await this.repository.markUsed(live.id, now);
    await this.repository.applyDeletionRequest(live.userId, now);
    return { scheduledFor: scheduledDeletionDate(now) };
  }
}
