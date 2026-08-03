import { api } from "./client";
import type { CurriculumTree } from "../curriculum/types";

export interface CurriculumOwner {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface CurriculumResponse {
  exists: boolean;
  id: string | null;
  tree: CurriculumTree | null;
  revision: number;
  published: boolean;
  archived: boolean;
  owner: CurriculumOwner;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CurriculumAuditEvent {
  id?: string;
  actor_id: string;
  actor_role: string;
  owner_id: string;
  resource_type: string;
  action: string;
  revision: number;
  summary: Record<string, unknown>;
  occurred_at: string;
  actor: CurriculumOwner;
}

export type CurriculumStatus = "draft" | "published" | "archived";

export interface CurriculumSummary {
  id: string;
  title: string;
  description: string;
  version: string;
  grades: { id: string; label: string }[];
  subjects: { id: string; label: string }[];
  primaryGradeId: string | null;
  primarySubjectId: string | null;
  status: CurriculumStatus;
  revision: number;
  unitCount: number;
  skillCount: number;
  createdAt: string;
  updatedAt: string;
  owner: CurriculumOwner;
}

export interface CurriculumCreateInput {
  title: string;
  description: string;
  version: string;
  primary_grade_id: string;
  primary_subject_id: string;
}

export type CurriculumImpactLevel = "initial" | "patch" | "minor" | "major";
export type CurriculumRolloutStrategy = "new_learners" | "active_learners";

export interface CurriculumImpactItem {
  id: string;
  label: string;
  fields?: string[];
}

/**
 * Whether the draft still says what learners are actually playing.
 *
 * `drifted` names the parts that differ from the newest release — any of "tree", "questions",
 * "assets". Empty means published and draft agree.
 */
export interface CurriculumDrift {
  hasRelease: boolean;
  revision: number | null;
  drifted: Array<"tree" | "questions" | "assets">;
  publishedAt: string | null;
}

export interface CurriculumReleaseImpact {
  level: CurriculumImpactLevel;
  addedSkills: CurriculumImpactItem[];
  removedSkills: CurriculumImpactItem[];
  structuralChanges: CurriculumImpactItem[];
  currentRelease: import("./assignments").ReleaseSummary | null;
  activeAssignments: number;
  activeLearners: number;
  affectedLearners: number;
}

export interface CurriculumRolloutResult {
  release: import("./assignments").ReleaseSummary;
  rollout: {
    strategy: CurriculumRolloutStrategy;
    impactLevel: CurriculumImpactLevel;
    offeringUpdated: boolean;
    assignmentsUpdated: number;
    learnersUpdated: number;
  };
}

export const curriculumApi = {
  list: () => api.get<{ curricula: CurriculumSummary[] }>("/curricula"),
  create: (body: CurriculumCreateInput) => api.post<CurriculumResponse>("/curricula", body),
  archive: (curriculumId: string, archived: boolean) =>
    api.patch<CurriculumResponse>(`/curricula/${curriculumId}/archive`, { archived }),
  get: (curriculumId?: string) => api.get<CurriculumResponse>(curriculumId ? `/curricula/${curriculumId}` : "/curriculum"),
  put: (tree: CurriculumTree, revision: number, published: boolean, curriculumId?: string) =>
    api.put<{ ok: true; revision: number; updatedAt: string }>(curriculumId ? `/curricula/${curriculumId}` : "/curriculum", { tree, revision, published }),
  audit: (limit = 100, curriculumId?: string) =>
    api.get<{ events: CurriculumAuditEvent[] }>(`/content-audit?resource_type=curriculum&limit=${limit}${curriculumId ? `&curriculum_id=${encodeURIComponent(curriculumId)}` : ""}`),
  releases: (curriculumId: string) =>
    api.get<{ releases: import("./assignments").ReleaseSummary[] }>("/curricula/" + curriculumId + "/releases"),
  /** Which parts of the draft no longer match the newest release. Empty when nothing changed. */
  drift: (curriculumId: string) =>
    api.get<CurriculumDrift>("/curricula/" + curriculumId + "/drift"),
  publishRelease: (curriculumId: string) =>
    api.post<import("./assignments").ReleaseSummary>("/curricula/" + curriculumId + "/releases"),
  releaseImpact: (curriculumId: string, gradeId: string, subjectId: string) => {
    const query = new URLSearchParams({ grade_id: gradeId, subject_id: subjectId });
    return api.get<CurriculumReleaseImpact>(`/curricula/${curriculumId}/release-impact?${query.toString()}`);
  },
  publishRollout: (
    curriculumId: string,
    body: { grade_id: string; subject_id: string; strategy: CurriculumRolloutStrategy },
  ) => api.post<CurriculumRolloutResult>(`/curricula/${curriculumId}/publish-rollout`, body),
};
