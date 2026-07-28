import { describe, expect, it } from "vitest";
import { deriveAccountState } from "./account-state.js";

describe("deriveAccountState", () => {
  it("keeps provisional web registrations pending password setup", () => {
    expect(
      deriveAccountState({
        isSuspended: false,
        passwordHash: null,
        emailVerifiedAt: null,
      }),
    ).toBe("PENDING_PASSWORD_SETUP");
  });

  it("keeps an incomplete password account pending email verification", () => {
    expect(
      deriveAccountState({
        isSuspended: false,
        passwordHash: "hash",
        emailVerifiedAt: null,
      }),
    ).toBe("PENDING_EMAIL_VERIFICATION");
  });

  it("marks a verified password account active", () => {
    expect(
      deriveAccountState({
        isSuspended: false,
        passwordHash: "hash",
        emailVerifiedAt: new Date(),
      }),
    ).toBe("ACTIVE");
  });

  it("prioritizes suspension over every other account fact", () => {
    expect(
      deriveAccountState({
        isSuspended: true,
        passwordHash: "hash",
        emailVerifiedAt: new Date(),
      }),
    ).toBe("SUSPENDED");
  });
});
