import { api } from "./client";

export interface AppSettings {
  sound_enabled: boolean;
  ai_model: string;
  api_key_configured: boolean;
  api_key_hint: string | null;
  scoring: ScoringConfig;
  scoring_revision: number;
}

export interface AppSettingsUpdate {
  sound_enabled?: boolean;
  ai_model?: string;
  openai_api_key?: string;
  clear_api_key?: boolean;
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
  recommendation: {
    skills_per_session: number;
    max_non_new: number;
    skip_cooldown_sessions: number;
    reinforce_threshold: number;
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
  rescoreJobs: () => api.get<{ jobs: RescoreJob[] }>("/settings/rescore-jobs"),
  previewScoring: (scoring: ScoringConfig, scoringRevision: number) =>
    api.post<ScoringPreview>("/settings/scoring-preview", {
      scoring,
      scoring_revision: scoringRevision,
    }),
};
