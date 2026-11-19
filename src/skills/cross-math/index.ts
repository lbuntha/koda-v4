import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as grid from "./activities/CrossMath";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Cross Math — grids of sums that share their numbers.
 *
 * One engine, `grid`, for all 36 lessons: a lesson is a spec (size, signs,
 * range, how many boxes are hidden) and the engine generates five fresh
 * puzzles from it every play, each checked to have exactly one answer.
 */
const info = describeSkill(manifestJson, lessonsJson);

// No skill art: the board is the picture.
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true }) as Record<string, string>,
  {},
  info.manifest.id,
);

export const skill: Skill = {
  ...info,
  assets: [],
  activities: {
    grid: {
      id: "grid",
      name: "Cross Math Grid",
      defaultParams: { ops: ["+"], max: 10, blanks: 2, questionsPerRound: 5 },
      component: grid.CrossMath,
      worksheet: undefined,
    },
  },
};
