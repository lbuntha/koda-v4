import { api } from "./client";
import type { CurriculumTree } from "../curriculum/types";
import type { CountingQuestion, CustomSvgAsset } from "../types";
import type { LearningEvent } from "../services/logSchema";

export interface PublishedCurriculum {
  assignmentId: string;
  releaseId: string;
  curriculumId: string;
  revision: number;
  tree: CurriculumTree;
  questions: CountingQuestion[];
  /**
   * Artwork frozen into this release, which the questions above reference by id. A student
   * has no editable SVG library to look them up in — see `assets/questionAsset.tsx`.
   */
  assets?: CustomSvgAsset[];
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
