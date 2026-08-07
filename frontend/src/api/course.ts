import { api } from "./client";
import type { CountingQuestion, CustomSvgAsset } from "../types";
import type { UnitAccent, UnitIcon } from "../curriculum/types";

export type CourseMode = "scheduled" | "free";
/**
 * `continue` is a started skill that is going well but has not yet earned enough plays to
 * reach `developing` — distinct from `review` (secure, resurfacing) and `reinforce` (a gap).
 */
export type RecommendationKind = "reinforce" | "continue" | "review" | "new" | "stretch" | "free";
export type ActivityStatus = "not_completed" | "in_progress" | "completed";

export interface CourseQueueItem {
  assignmentId: string;
  releaseId: string;
  curriculumId: string;
  curriculumRevision: number;
  skillId: string;
  skillLabel: string;
  curriculumSkillLabel?: string;
  description?: string;
  thumbnailUrl?: string | null;
  accent?: "purple" | "blue" | "green" | "amber" | "pink";
  /** Authored in the curriculum — the learner UI shows this rather than guessing a duration. */
  estimatedMinutes?: number;
  xpAvailable?: number;
  unitId?: string | null;
  subjectId?: string | null;
  kind: RecommendationKind;
  reason: string;
  optional: boolean;
  status?: ActivityStatus;
  questions: CountingQuestion[];
  /**
   * Artwork frozen into the release, which the questions above reference by id. A student has
   * no editable SVG library to resolve those ids against — see `assets/questionAsset.tsx`.
   */
  assets?: CustomSvgAsset[];
}

export interface CompletedCourseItem {
  assignmentId: string;
  releaseId: string;
  curriculumId: string;
  skillId: string;
  skillLabel: string;
  curriculumSkillLabel?: string;
  thumbnailUrl?: string | null;
  xpEarned?: number;
  status: "completed";
  completedAt: string;
}

export interface TodayCourse {
  mode: CourseMode;
  subjectId?: string | null;
  sessionId: string;
  recommendationRunId: string | null;
  engineRevision?: string;
  queue: CourseQueueItem[];
  completedItems?: CompletedCourseItem[];
  completedCount?: number;
  quest?: {
    label: string;
    target: number;
    completed: number;
    xpEarned: number;
  };
}

export interface LearnerSubject {
  id: string;
  name: string;
  icon?: string;
  iconAsset?: import("../types").CustomSvgAsset | null;
  color: string;
  assignmentId: string;
  ready: boolean;
  primary: boolean;
}

export interface LearnerSubjects {
  currentSubjectId: string | null;
  subjects: LearnerSubject[];
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
  /** Unit name for learner-facing skill paths; absent on historical rows. */
  unitLabel?: string | null;
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
  rewardProfile?: {
    totalXp: number;
    level: {
      number: number;
      currentXp: number;
      xpPerLevel: number;
      xpToNext: number;
      progress: number;
    } | null;
    achievements: Array<{
      curriculumId: string;
      id: string;
      label: string;
      description: string;
      metric: "xpEarned" | "lessonsCompleted" | "firstTryCorrect" | "proficientSkills" | "masteredSkills" | "streakDays";
      target: number;
      icon: "star" | "medal" | "award" | "trophy" | "gem" | "flame";
      accent: "purple" | "blue" | "green" | "amber" | "pink";
      current: number;
      earned: boolean;
      progress: number;
    }>;
  };
  skills: SkillProgress[];
}

/**
 * Where one skill stands on the curriculum road. Server-derived from mastery + prerequisites
 * — see `backend/app/features/learning/path.py`.
 */
export type SkillPathStatus = "completed" | "overdue" | "in_progress" | "new" | "pending";

export interface PathSkill {
  skillId: string;
  skillLabel: string;
  unitId?: string | null;
  unitLabel?: string | null;
  status: SkillPathStatus;
  level: MasteryLevel;
  score: number;
  /** Index in curriculum order across the whole assigned grade. */
  position: number;
  /** False when the release published no questions for this skill. */
  playable: boolean;
}

export interface PathUnit {
  unitId?: string | null;
  unitLabel: string;
  unitIcon?: UnitIcon | null;
  unitAccent?: UnitAccent | null;
  subjectId?: string | null;
  subjectLabel?: string | null;
  gradeId?: string | null;
  gradeLabel?: string | null;
  skills: PathSkill[];
}

export interface CurriculumPath {
  pathRevision: string;
  assignmentId: string;
  curriculumId: string;
  releaseId: string;
  gradeId?: string | null;
  units: PathUnit[];
  counts: {
    completed: number;
    overdue: number;
    inProgress: number;
    new: number;
    pending: number;
    total: number;
  };
  /** True once every required skill in this immutable assignment release is Master. */
  complete: boolean;
  /** First skill still wanting work, walking the curriculum A→Z. Null when the path is done. */
  nextSkill: PathSkill | null;
}

export interface StudentActivitySignal {
  studentId: string;
  currentStreakDays: number;
  weeklyActivity: Array<{
    date: string;
    day: string;
    count: number;
  }>;
}

export const courseApi = {
  startSession: (source: "independent" | "parent_launch") =>
    api.post<StudentSessionResult>("/sessions/start", { source }),
  endSession: (session_id: string) =>
    api.post<StudentSessionResult>("/sessions/end", { session_id }),
  today: (mode: CourseMode = "scheduled", subjectId?: string | null) =>
    api.get<TodayCourse>(`/learning/today?mode=${mode}${subjectId ? `&subject_id=${encodeURIComponent(subjectId)}` : ""}`),
  subjects: () => api.get<LearnerSubjects>("/learning/subjects"),
  selectSubject: (subjectId: string) => api.put<{ currentSubjectId: string }>(
    "/learning/subjects/current",
    { subject_id: subjectId },
  ),
  /** The full assigned curriculum walk, A→Z, with each skill's status. */
  path: (subjectId?: string | null) => api.get<{ paths: CurriculumPath[] }>(
    `/learning/path${subjectId ? `?subject_id=${encodeURIComponent(subjectId)}` : ""}`,
  ),
  progress: (studentId: string) =>
    api.get<StudentProgress>(`/progress/${encodeURIComponent(studentId)}`),
  activitySignal: (studentId: string) =>
    api.get<StudentActivitySignal>(`/progress/${encodeURIComponent(studentId)}/activity-signal`),
  skip: (runId: string, item: Pick<CourseQueueItem, "assignmentId" | "skillId">) =>
    api.post<{ ok: true; eventId: string | null; requeuedAfter: string }>("/events/skip", {
      recommendation_run_id: runId,
      skill_id: item.skillId,
      from: "recommendation",
    }),
};
