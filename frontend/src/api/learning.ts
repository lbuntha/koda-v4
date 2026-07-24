import { api } from "./client";
import type { CurriculumTree } from "../curriculum/types";
import type { CountingQuestion } from "../types";
import type { LearningEvent } from "../services/logSchema";

export interface PublishedCurriculum {
  assignmentId: string;
  releaseId: string;
  curriculumId: string;
  revision: number;
  tree: CurriculumTree;
  questions: CountingQuestion[];
  frontierSkillId: string | null;
  eligibleSkillIds: string[];
  deliverySkillIds: string[];
}

export const learningApi = {
  curriculum: () => api.get<PublishedCurriculum>("/learning/curriculum"),
  ingestEvents: (events: LearningEvent[]) => api.post<{
    inserted: number;
    duplicates: number;
    unverified: number;
    masteryUpdates: Array<{
      skillId: string;
      curriculumId: string | null;
      previousLevel: string;
      level: string;
      promoted: boolean;
    }>;
  }>("/events", { events }),
};
