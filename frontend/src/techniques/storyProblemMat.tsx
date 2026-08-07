import React from "react";
import { BookOpenCheck } from "lucide-react";
import { CountingTechnique } from "../types";
import { storyProblemMatSchema } from "../components/studio/ai-generator/schemas/storyProblemMat.schema";
import { defineTechnique } from "./manifest";

export const storyProblemMat = defineTechnique({
  technique: CountingTechnique.STORY_PROBLEM_MAT,
  label: "Story Problem Mat",
  icon: <BookOpenCheck size={14} className="text-violet-600" />,
  defaultTargetCount: 9,
  component: React.lazy(() => import("../components/canvases/StoryProblemMatCanvas").then(module => ({ default: module.StoryProblemMatCanvas }))),
  panel: React.lazy(() => import("../components/studio/panels/StoryProblemMatPanel").then(module => ({ default: module.StoryProblemMatPanel }))),
  schema: storyProblemMatSchema,
});
