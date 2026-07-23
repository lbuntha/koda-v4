import { api } from "./client";
import type { CountingQuestion } from "../types";

export interface PlacementQuiz {
  placementId: string | null;
  assignmentId?: string;
  releaseId?: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "none";
  items: (CountingQuestion & { placementItemId: string; skillId: string })[];
  frontierSkillId: string | null;
  eligibleSkillIds: string[];
}

export interface PlacementResult extends PlacementQuiz {
  scoreBySkill?: Record<string, number>;
}

export const placementApi = {
  quiz: () => api.get<PlacementQuiz>("/student/placement/quiz"),
  submit: (placementId: string, responses: { questionId: string; selection: string }[]) =>
    api.post<PlacementResult>("/student/placement/" + placementId + "/submit", { responses }),
};
