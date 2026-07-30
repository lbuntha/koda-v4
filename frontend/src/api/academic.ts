import { api } from "./client";
import type { GradeBand } from "./auth";

export interface GradeCatalogItem {
  key: string;
  code: string;
  name: string;
  description: string;
  age_range: string;
  order: number;
  /** Explicit student-page band; null ⇒ auto-derived from `order`. */
  layout_band: GradeBand | null;
  /** Server-computed effective band (explicit value, else the auto default). */
  effective_band: GradeBand;
  active: boolean;
  revision: number;
  updated_at: string;
}

export interface SubjectCatalogItem {
  key: string;
  grade_id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  active: boolean;
  /** A published curriculum offering is available for learners. */
  content_ready?: boolean;
  revision: number;
  updated_at: string;
}

export type GradeCatalogInput = Omit<GradeCatalogItem, "updated_at" | "effective_band">;
export type SubjectCatalogInput = Omit<SubjectCatalogItem, "updated_at" | "content_ready">;

export interface AcademicCatalog {
  grades: GradeCatalogItem[];
  subjects: SubjectCatalogItem[];
}

export interface CurriculumOffering {
  grade_id: string;
  subject_id: string;
  curriculum_id: string;
  release_id: string;
  active: boolean;
  successor_grade_id: string | null;
  successor_subject_id: string | null;
  promotion_completion_rule: "activities_completed" | "proficient" | "master";
  promotion_placement_required: boolean;
  revision: number;
  updated_at: string;
}

export const academicApi = {
  list: () => api.get<AcademicCatalog>("/settings/curriculum-catalog"),
  createGrade: (body: GradeCatalogInput) => api.post<GradeCatalogItem>("/settings/grades", body),
  updateGrade: (key: string, body: GradeCatalogInput) => api.put<GradeCatalogItem>(`/settings/grades/${key}`, body),
  deleteGrade: (key: string) => api.del<void>(`/settings/grades/${key}`),
  createSubject: (body: SubjectCatalogInput) => api.post<SubjectCatalogItem>("/settings/subjects", body),
  updateSubject: (key: string, body: SubjectCatalogInput) => api.put<SubjectCatalogItem>(`/settings/subjects/${key}`, body),
  deleteSubject: (key: string) => api.del<void>(`/settings/subjects/${key}`),
  listOfferings: () => api.get<{ offerings: CurriculumOffering[] }>("/settings/curriculum-offerings"),
  putOffering: (body: Omit<CurriculumOffering, "updated_at">) =>
    api.put<CurriculumOffering>("/settings/curriculum-offerings", body),
};
