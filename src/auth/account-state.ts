export type DerivedAccountState =
  | "SUSPENDED"
  | "PENDING_PASSWORD_SETUP"
  | "PENDING_EMAIL_VERIFICATION"
  | "ACTIVE";

export interface AccountStateInput {
  isSuspended: boolean;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
}

/**
 * Derives account readiness from persisted account facts. This intentionally
 * avoids a duplicate account-status column that could become inconsistent.
 */
export function deriveAccountState(account: AccountStateInput): DerivedAccountState {
  if (account.isSuspended) {
    return "SUSPENDED";
  }

  if (account.passwordHash === null) {
    return "PENDING_PASSWORD_SETUP";
  }

  if (account.emailVerifiedAt === null) {
    return "PENDING_EMAIL_VERIFICATION";
  }

  return "ACTIVE";
}
