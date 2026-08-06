import { api } from "./client";

export interface Assignment {
  id: string;
  ownerId: string;
  studentId: string;
  curriculumId: string;
  releaseId: string;
  gradeId: string;
  scope: { kind: "all" | "grades" | "units" | "skills"; ids: string[] };
  mode: "scheduled" | "self_paced";
  schedule: Record<string, unknown> | null;
  priority: number;
  placementRequired: boolean;
  status: "active" | "paused" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseSummary {
  releaseId: string;
  curriculumId: string;
  revision: number;
  questionCount: number;
  assetCount: number;
  publishedAt: string;
}

export interface AssignableStudent {
  id: string;
  name: string;
  avatar: string | null;
}

export const assignmentsApi = {
  list: () => api.get<{ assignments: Assignment[] }>("/assignments"),
  students: () => api.get<{ students: AssignableStudent[] }>("/assignment-students"),
  create: (body: {
    student_id: string;
    curriculum_id: string;
    release_id: string;
    grade_id: string;
    scope: { kind: "all"; ids: string[] };
    mode: "scheduled" | "self_paced";
    placement_required: boolean;
  }) => api.post<Assignment>("/assignments", body),
  setStatus: (id: string, status: Assignment["status"]) =>
    api.patch<Assignment>("/assignments/" + id, { status }),
  /**
   * Move a learner onto a newer release of the same curriculum. Releases are immutable, so
   * published changes — a skill's artwork, a new question — only reach a student through this.
   */
  setRelease: (id: string, releaseId: string) =>
    api.patch<Assignment>("/assignments/" + id, { release_id: releaseId }),
  /**
   * Take an assignment off a learner for good.
   *
   * Pausing only stops it being served. This removes it, along with the
   * placement and progression that exist only because of it. Play history is
   * kept — XP and streaks are replayed from events, so deleting those would
   * silently rewrite what a child has done.
   */
  remove: (id: string) =>
    api.del<{ deleted: boolean; placements: number; progressions: number; promotions: number; eventsKept: number }>(
      "/assignments/" + id,
    ),
};
