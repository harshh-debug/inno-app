import { Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors.js";
import type { TokenDenylist } from "../authentication/token-denylist.js";
import type { VerifiedAccessTokenClaims } from "../authentication/token.js";
import { scheduledDeletionDate } from "./account-deletion.constants.js";
import type {
  AccountDeletionRequest,
  AppProfile,
  AppProfileRepository,
  AppProfileUpdate,
  AppRecruitmentSummary,
} from "./app-profile.types.js";

export class AppProfileService {
  constructor(
    private readonly repository: AppProfileRepository,
    private readonly denylist?: TokenDenylist,
  ) {}

  async getProfile(userId: string): Promise<AppProfile> {
    const profile = await this.repository.findProfileByUserId(userId);
    if (profile === null) {
      throw new AppError("USER_NOT_FOUND", 404, "User not found");
    }
    return profile;
  }

  async updateProfile(userId: string, input: AppProfileUpdate): Promise<AppProfile> {
    try {
      return await this.repository.updateProfile(userId, input);
    } catch (error) {
      // P2025: Prisma's "record to update not found" — the user was deleted between
      // requireAppStudent and this write. Surface it as the same stable 404 getProfile uses.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError("USER_NOT_FOUND", 404, "User not found");
      }
      throw error;
    }
  }

  // Sets deletionRequestedAt and revokes the token that made this call, in the
  // same request — the button press must actually start deletion, not just
  // message someone (Play policy). Mirrors AuthService.logout's revoke call.
  async requestDeletion(userId: string, claims: VerifiedAccessTokenClaims): Promise<AccountDeletionRequest> {
    const requestedAt = await this.repository.requestDeletion(userId);
    if (this.denylist !== undefined) {
      await this.denylist.revoke(claims.jti, claims.expiresAt);
    }
    return {
      deletionRequestedAt: requestedAt.toISOString(),
      scheduledFor: scheduledDeletionDate(requestedAt).toISOString(),
    };
  }

  // Cancel path — the caller had to log back in to reach this (their prior
  // token was revoked by requestDeletion), which is the extra confirmation step.
  async cancelDeletion(userId: string): Promise<void> {
    await this.repository.cancelDeletion(userId);
  }

  async getRecruitmentSummary(userId: string): Promise<AppRecruitmentSummary> {
    const summary = await this.repository.findRecruitmentSummaryByUserId(userId);
    if (summary === null) {
      // requireAppStudent already confirmed a paid active-cycle registration
      // exists, so reaching this branch means a race between that check and
      // this read (e.g. an admin flipped the cycle in between) rather than a
      // normal "no registration" case.
      throw new AppError("APP_ACCESS_DENIED", 403, "App access is not available");
    }
    return summary;
  }
}
