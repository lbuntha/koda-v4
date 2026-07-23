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
};
