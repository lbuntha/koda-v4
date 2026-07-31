import { api } from "./client";

/** `withdrawn`: detected once, but the learner no longer meets the configured
 *  requirement (it was raised, or a re-score lowered their mastery). Kept out of the
 *  actionable list below, and restored to `pending` by the server if they qualify again. */
export type PromotionStatus = "pending" | "deferred" | "completed" | "withdrawn";

export interface CurriculumPromotion {
  id: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  fromAssignmentId: string;
  fromCurriculumId: string;
  fromCurriculumTitle: string;
  fromGradeId: string;
  fromGradeName: string;
  toGradeId: string | null;
  toGradeName: string | null;
  toSubjectId: string | null;
  toSubjectName: string | null;
  toCurriculumId: string | null;
  toReleaseId: string | null;
  toAssignmentId: string | null;
  status: PromotionStatus;
  successorReady: boolean;
  detectedAt: string;
  deferredUntil: string | null;
  decidedAt: string | null;
}

export const promotionsApi = {
  list: () => api.get<{ promotions: CurriculumPromotion[] }>("/promotions"),
  adminList: () => api.get<{ promotions: CurriculumPromotion[] }>("/promotions/admin"),
  approve: (id: string) => api.post<CurriculumPromotion>(`/promotions/${id}/approve`, {}),
  defer: (id: string) => api.post<CurriculumPromotion>(`/promotions/${id}/defer`, {}),
};
