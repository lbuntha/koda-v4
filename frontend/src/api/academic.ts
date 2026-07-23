import { api } from "./client";

export interface GradeCatalogItem {
  key: string;
  code: string;
  name: string;
  description: string;
  age_range: string;
  order: number;
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
  revision: number;
  updated_at: string;
}

export type GradeCatalogInput = Omit<GradeCatalogItem, "updated_at">;
export type SubjectCatalogInput = Omit<SubjectCatalogItem, "updated_at">;

export interface AcademicCatalog {
  grades: GradeCatalogItem[];
  subjects: SubjectCatalogItem[];
}

export const academicApi = {
  list: () => api.get<AcademicCatalog>("/settings/curriculum-catalog"),
  createGrade: (body: GradeCatalogInput) => api.post<GradeCatalogItem>("/settings/grades", body),
  updateGrade: (key: string, body: GradeCatalogInput) => api.put<GradeCatalogItem>(`/settings/grades/${key}`, body),
  deleteGrade: (key: string) => api.del<void>(`/settings/grades/${key}`),
  createSubject: (body: SubjectCatalogInput) => api.post<SubjectCatalogItem>("/settings/subjects", body),
  updateSubject: (key: string, body: SubjectCatalogInput) => api.put<SubjectCatalogItem>(`/settings/subjects/${key}`, body),
  deleteSubject: (key: string) => api.del<void>(`/settings/subjects/${key}`),
};
