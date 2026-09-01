import { AppError } from "../../common/errors.js";
import type { AppProfile, AppProfileRepository, AppProfileUpdate, AppRecruitmentSummary } from "./app-profile.types.js";

export class AppProfileService {
  constructor(private readonly repository: AppProfileRepository) {}

  async getProfile(userId: string): Promise<AppProfile> {
    const profile = await this.repository.findProfileByUserId(userId);
    if (profile === null) {
      throw new AppError("USER_NOT_FOUND", 404, "User not found");
    }
    return profile;
  }

  async updateProfile(userId: string, input: AppProfileUpdate): Promise<AppProfile> {
    return this.repository.updateProfile(userId, input);
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
