import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as game from "./activities/Sudoku";
import * as spot from "./activities/Spot";
import { registerSkillVoice } from "../../lib/voiceClips";
import { registerSkillArt } from "../../assets/svg/skillArt";
import audioManifest from "./audio/manifest.json";

/**
 * Sudoku — one solving technique at a time.
 *
 * Two engines. `game` is a whole puzzle that needs the lesson's technique and
 * nothing harder; `spot` stops a board at the moment that technique is the next
 * step, and times how fast the child finds it. Both make new puzzles every
 * play; the hardest techniques come from a remixed stock (`internal/bank.json`).
 */
const info = describeSkill(manifestJson, lessonsJson);

/** Lesson and unit icons, referenced as `sudoku-scan-box` and so on. */
const assets = registerSkillArt(info.manifest.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true }) as Record<string, string>,
  {},
  info.manifest.id,
);

export const skill: Skill = {
  ...info,
  assets,
  activities: {
    game: {
      id: "game",
      name: "Sudoku Puzzle",
      defaultParams: { size: 4, technique: "full-house", questionsPerRound: 3 },
      component: game.Sudoku,
      worksheet: undefined,
    },
    spot: {
      id: "spot",
      name: "Spot the Technique",
      defaultParams: { size: 9, technique: "hidden-single-box", questionsPerRound: 6 },
      component: spot.Spot,
      worksheet: undefined,
    },
  },
};
