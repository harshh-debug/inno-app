/**
 * The canonical matching key for all platform identities. The original email
 * casing is preserved separately for display and delivery.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
