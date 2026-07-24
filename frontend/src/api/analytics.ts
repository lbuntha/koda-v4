import { api } from "./client";

export interface AnalyticsStudent {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface MasterySkill {
  curriculumId: string;
  skillId: string;
  skillLabel: string;
  unitId?: string | null;
  subjectId?: string | null;
  gradeId?: string | null;
  assignmentId?: string | null;
  level: "not_started" | "beginner" | "developing" | "proficient" | "master";
  score: number;
  plays: number;
  sessions: number;
  distinctDays: number;
  hardPlays: number;
  recentScore: number;
  lastPracticedAt?: string | null;
  nextReviewAt?: string | null;
  isDue: boolean;
  nextLevel?: string | null;
  toNextLevel: string[];
  projectionStatus: string;
}

export interface MasterySnapshot {
  studentId: string;
  scoringRevision: number;
  engineRevision: string;
  rank: {
    tier: string;
    tierLabel: string;
    mastered: number;
    proficientPlus: number;
    totalSkills: number;
    assignedSkills: number;
    progressToNext: number;
  };
  skills: MasterySkill[];
}

export interface ActivitySnapshot {
  studentId: string;
  summary: {
    totalEvents: number;
    totalAttempts: number;
    correct: number;
    incorrect: number;
    accuracy: number | null;
    hints: number;
    lessonsCompleted: number;
    timeOnTaskMs: number;
    currentStreakDays: number;
    longestStreakDays: number;
    activeDays: number;
  };
  sessions: Array<{
    sessionId: string;
    source: string;
    startedAt: string;
    endedAt?: string | null;
    eventsCount: number;
  }>;
  events: Array<{
    id: string;
    occurredAt: string;
    eventType?: string | null;
    outcome?: string | null;
    questionId?: string | null;
    skillId?: string | null;
    assignmentId?: string | null;
    technique?: string | null;
    hintUsed?: boolean | null;
    timeOnTaskMs?: number | null;
    verified: boolean;
    summary?: string | null;
  }>;
}

export interface RecommendationSnapshot {
  studentId: string;
  runs: Array<{
    runId: string;
    sessionId: string;
    sequence: number;
    createdAt: string;
    invalidatedAt?: string | null;
    scoringRevision: number;
    engineRevision: string;
    served: Array<{
      assignmentId?: string | null;
      curriculumId?: string | null;
      skillId?: string | null;
      skillLabel?: string | null;
      kind?: string | null;
      reason?: string | null;
    }>;
    decisions: Array<{
      action?: string;
      skill_id?: string;
      assignment_id?: string;
      occurred_at?: string;
    }>;
    excluded: Array<{
      skillId?: string | null;
      skillLabel?: string | null;
      reason?: string | null;
    }>;
  }>;
}

const params = (values: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const output = query.toString();
  return output ? `?${output}` : "";
};

export const analyticsApi = {
  roster: () => api.get<{ students: AnalyticsStudent[] }>("/analytics/students"),
  mastery: (
    studentId: string,
    filters: { subjectId?: string; gradeId?: string; assignmentId?: string } = {},
  ) => api.get<MasterySnapshot>(`/analytics/mastery${params({
    student_id: studentId,
    subject_id: filters.subjectId,
    grade_id: filters.gradeId,
    assignment_id: filters.assignmentId,
  })}`),
  activity: (studentId: string, assignmentId?: string) =>
    api.get<ActivitySnapshot>(`/analytics/activity${params({
      student_id: studentId,
      assignment_id: assignmentId,
      limit: 200,
    })}`),
  recommendations: (studentId: string) =>
    api.get<RecommendationSnapshot>(`/analytics/recommendations${params({
      student_id: studentId,
      limit: 30,
    })}`),
  exportData: (studentId: string) =>
    api.get<Record<string, unknown>>(`/analytics/data-export/${studentId}`),
  purgeData: (studentId: string, reason: string) =>
    api.del<{ ok: true; deleted: Record<string, number> }>(`/analytics/data/${studentId}`, {
      confirmation: "DELETE",
      reason,
    }),
};
