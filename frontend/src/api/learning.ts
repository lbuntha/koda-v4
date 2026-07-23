import { api } from "./client";
import type { CurriculumTree } from "../curriculum/types";
import type { CountingQuestion } from "../types";
import type { LearningEvent } from "../services/logSchema";

export interface PublishedCurriculum {
  curriculumId: string;
  revision: number;
  tree: CurriculumTree;
  questions: CountingQuestion[];
}

export const learningApi = {
  curriculum: () => api.get<PublishedCurriculum>("/learning/curriculum"),
  ingestEvents: (events: LearningEvent[]) => api.post<{ inserted: number; duplicates: number }>("/events", { events }),
};
