import { api } from "./client";
import type { CountingQuestion } from "../types";

export interface QuestionDeckResponse {
  exists: boolean;
  questions: CountingQuestion[];
  revision: number;
}

export const questionsApi = {
  get: () => api.get<QuestionDeckResponse>("/questions"),
  put: (questions: CountingQuestion[], revision: number) =>
    api.put<{ ok: true; revision: number }>("/questions", { questions, revision }),
};
