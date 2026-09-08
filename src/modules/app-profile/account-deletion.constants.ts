// Shared by AppProfileService (deletion-request) and AuthService (login-time
// scheduledFor calculation) so the two never drift out of sync.
export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 14;

export function scheduledDeletionDate(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1_000);
}
