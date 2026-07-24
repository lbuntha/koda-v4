import { api } from "./client";
import type { CountingQuestion } from "../types";

export type CourseMode = "scheduled" | "free";
export type RecommendationKind = "reinforce" | "review" | "new" | "stretch" | "free";

export interface CourseQueueItem {
  assignmentId: string;
  releaseId: string;
  curriculumId: string;
  curriculumRevision: number;
  skillId: string;
  skillLabel: string;
  unitId?: string | null;
  subjectId?: string | null;
  kind: RecommendationKind;
  reason: string;
  optional: boolean;
  questions: CountingQuestion[];
}

export interface TodayCourse {
  mode: CourseMode;
  sessionId: string;
  recommendationRunId: string | null;
  engineRevision?: string;
  queue: CourseQueueItem[];
}

export interface StudentSessionResult {
  sessionId: string;
  source: "independent" | "parent_launch";
  startedAt: string;
  endedAt: string | null;
  eventsCount: number;
}

export type MasteryLevel = "not_started" | "beginner" | "developing" | "proficient" | "master";

export interface SkillProgress {
  curriculumId: string;
  skillId: string;
  skillLabel: string;
  unitId?: string | null;
  subjectId?: string | null;
  level: MasteryLevel;
  highestEarnedLevel: MasteryLevel;
  score: number;
  components: Record<string, number | boolean>;
  plays: number;
  sessions: number;
  distinctDays: number;
  hardPlays: number;
  recentScore: number;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  isDue: boolean;
  nextLevel: MasteryLevel | null;
  toNextLevel: string[];
  promotedAt: string | null;
  projectionStatus: "current" | "stale" | "not_started";
}

export interface StudentProgress {
  studentId: string;
  scoringRevision: number;
  engineRevision: string;
  rank: {
    tier: "rookie" | "bronze" | "silver" | "gold" | "master";
    tierLabel: string;
    mastered: number;
    proficientPlus: number;
    totalSkills: number;
    assignedSkills: number;
    progressToNext: number;
  };
  skills: SkillProgress[];
}

export const courseApi = {
  startSession: (source: "independent" | "parent_launch") =>
    api.post<StudentSessionResult>("/sessions/start", { source }),
  endSession: (session_id: string) =>
    api.post<StudentSessionResult>("/sessions/end", { session_id }),
  today: (mode: CourseMode = "scheduled") =>
    api.get<TodayCourse>(`/learning/today?mode=${mode}`),
  progress: (studentId: string) =>
    api.get<StudentProgress>(`/progress/${encodeURIComponent(studentId)}`),
  skip: (runId: string, item: Pick<CourseQueueItem, "assignmentId" | "skillId">) =>
    api.post<{ ok: true; eventId: string | null; requeuedAfter: string }>("/events/skip", {
      recommendation_run_id: runId,
      skill_id: item.skillId,
      from: "recommendation",
    }),
};
