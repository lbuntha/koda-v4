import { api } from "./client";
import type { CustomSvgAsset } from "../types";

export interface AppSettings {
  sound_enabled: boolean;
  ai_model: string;
  api_key_configured: boolean;
  api_key_hint: string | null;
  mail_transport: "console" | "smtp";
  mail_configured: boolean;
  mail_from: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_use_tls: boolean | null;
  smtp_password_hint: string | null;
  scoring: ScoringConfig;
  scoring_revision: number;
  mastery_gate_assets: Partial<Record<"beginner" | "developing" | "proficient" | "master", CustomSvgAsset>>;
}

export interface AppSettingsUpdate {
  sound_enabled?: boolean;
  ai_model?: string;
  openai_api_key?: string;
  clear_api_key?: boolean;
  mail_transport?: "console" | "smtp";
  mail_from?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_username?: string;
  smtp_password?: string;
  clear_smtp_password?: boolean;
  smtp_use_tls?: boolean;
  scoring?: ScoringConfig;
  scoring_revision?: number;
}

export interface ScoringConfig {
  weights: {
    firstTry: number;
    accuracy: number;
    independence: number;
    speed: number;
  };
  developingScore: number;
  proficientScore: number;
  masterScore: number;
  successfulReviewScore: number;
  gates: {
    developing: { minPlays: number };
    proficient: { minPlays: number; minSessions: number; minHardPlays: number };
    master: { minPlays: number; minDistinctDays: number; minHardPlays: number; minRecentScore: number };
  };
  speedBaselineMs: number;
  reviewIntervalDays: {
    not_started: null;
    beginner: number;
    developing: number;
    proficient: number;
    master: number;
  };
  placement: {
    per_skill: number;
    checkpoint_cap: number;
    pass_threshold: number;
    checkpoints_only: boolean;
    generator_revision: number;
    rapid_confirmation_plays: number;
  };
  streak: {
    /** What earns a day: any event, a verified answer, or a finished activity. */
    counts: "any" | "attempt" | "lesson_complete";
    min_events_per_day: number;
    grace_days: number;
  };
  recommendation: {
    skills_per_session: number;
    max_non_new: number;
    skip_cooldown_sessions: number;
    reinforce_threshold: number;
  };
  notifications: {
    auto_achievement_enabled: boolean;
    auto_streak_enabled: boolean;
    auto_weekly_digest_enabled: boolean;
    weekly_digest_day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    streak_milestones: number[];
    auto_review_enabled: boolean;
    auto_inactivity_enabled: boolean;
    inactivity_days: number;
    auto_pin_lockout_enabled: boolean;
  };
}

export interface RescoreJob {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  target_scoring_revision: number;
  students_total: number;
  students_processed: number;
  states_written: number;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface ScoringPreview {
  currentRevision: number;
  proposedRevision: number;
  studentsScanned: number;
  skillsScanned: number;
  affectedStudents: number;
  changedSkills: number;
  scoreChangedSkills: number;
  promotedSkills: number;
  demotedSkills: number;
  reviewDueChanged: number;
  unchangedSkills: number;
  transitions: Array<{ from: string; to: string; count: number }>;
  sampleChanges: Array<{
    studentId: string;
    studentName: string;
    curriculumId?: string | null;
    skillId: string;
    beforeLevel: string;
    afterLevel: string;
    beforeScore: number;
    afterScore: number;
    beforeDue: boolean;
    afterDue: boolean;
  }>;
  sampleTruncated: boolean;
  deliveryImpact: {
    sessionPlan: {
      current: { skills: number; newSlots: number; reviewSlots: number };
      proposed: { skills: number; newSlots: number; reviewSlots: number };
    };
    skipCooldownSessions: { current: number; proposed: number };
    placementMaximumItems: { current: number; proposed: number };
    placementPassThreshold: { current: number; proposed: number };
  };
  readOnly: true;
}

export const settingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (body: AppSettingsUpdate) => api.put<AppSettings>("/settings", body),
  testAi: () => api.post<{ ok: true }>("/settings/test-ai"),
  testMail: () => api.post<{ ok: true; sentTo: string }>("/settings/test-mail"),
  rescoreJobs: () => api.get<{ jobs: RescoreJob[] }>("/settings/rescore-jobs"),
  previewScoring: (scoring: ScoringConfig, scoringRevision: number) =>
    api.post<ScoringPreview>("/settings/scoring-preview", {
      scoring,
      scoring_revision: scoringRevision,
    }),
};
