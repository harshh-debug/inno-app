import type { PlatformRole, RecruitmentDecision } from "../../../generated/prisma/client.js";

// Gap 2 — GET /app/me. Only fields that actually exist on the schema today.
// enrollmentNumber / branch / section / semester / CGPA / domainPreferences
// are deliberately not here — see APP_API_GAPS_RESPONSE.md.
export interface AppProfile {
  collegeEmail: string;
  fullName: string | null;
  phone: string | null;
  batch: string | null;
  year: number | null;
  role: PlatformRole;
}

// Gap 3 — GET /app/recruitment
export interface AppRecruitmentTestSlot {
  booked: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface AppRecruitmentSummary {
  paid: boolean;
  decision: RecruitmentDecision;
  decisionNote: string | null;
  testSlot: AppRecruitmentTestSlot;
}

export interface AppProfileRepository {
  findProfileByUserId(userId: string): Promise<AppProfile | null>;
  findRecruitmentSummaryByUserId(userId: string): Promise<AppRecruitmentSummary | null>;
}
