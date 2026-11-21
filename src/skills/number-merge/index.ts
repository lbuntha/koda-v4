import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as board from "./activities/Merge";
import * as sheet from "./activities/Sheet";
import { registerSkillVoice } from "../../lib/voiceClips";
import { registerSkillArt } from "../../assets/svg/skillArt";
import audioManifest from "./audio/manifest.json";

/**
 * Number Merge — move a number onto its neighbour, and the two merge.
 *
 * One engine, `board`, for all 40 lessons. A lesson is a mode (bonds,
 * differences, doubles, exact sums, tens and hundreds, products, fractions),
 * a target and a board size; every play makes a fresh board from it, and the
 * board always has a move. Tiles can be dragged or tapped; the `drag_merge`
 * switch turns dragging off.
 */
const info = describeSkill(manifestJson, lessonsJson);

/** Lesson and unit icons, referenced as `number-merge-bonds` and so on. */
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
      name: "Number Merge Board",
      defaultParams: { mode: "bond", target: 10, size: 4, questionsPerRound: 6 },
      component: board.Merge,
      // On paper, each merge is asked the other way round: one tile given,
      // the partner left blank ("7 + ___ = 10"), drawn as the board shows it.
      worksheet: {
        build: sheet.buildSheetQuestion,
        prompt: sheet.sheetPrompt,
        printed: sheet.printedFor,
        method: sheet.sheetMethod,
        figure: sheet.figureFor,
      },
    },
  },
};
