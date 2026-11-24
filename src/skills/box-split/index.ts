import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as board from "./activities/BoxSplit";
import { registerSkillVoice } from "../../lib/voiceClips";
import { registerSkillArt } from "../../assets/svg/skillArt";
import audioManifest from "./audio/manifest.json";

/**
 * Box Split — a Shikaku-style puzzle. Split the grid into boxes; each box holds
 * one number and covers that many squares.
 *
 * One engine, `board`, for all 48 lessons. A lesson names the grid, the box
 * sizes and the hardest rule its puzzles need (only one fit, only one reaches,
 * shared squares); every play makes new puzzles to that spec on the device, so
 * it works offline. Boxes can be dragged corner to corner or tapped out; the
 * `drag_draw` switch turns dragging off.
 */
const info = describeSkill(manifestJson, lessonsJson);

/** Lesson and unit icons, referenced as `box-split-count` and so on. */
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
    board: {
      id: "board",
      name: "Box Split Board",
      defaultParams: { size: 4, maxArea: 4, technique: "single-fit", questionsPerRound: 3 },
      component: board.BoxSplit,
      worksheet: undefined,
    },
  },
};
