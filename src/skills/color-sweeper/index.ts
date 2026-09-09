import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as neighbors from "./activities/NeighborLens";
import * as board from "./activities/SweeperBoard";
import * as reason from "./activities/ClueLab";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Color Sweeper — a grid solved by reasons rather than by guesses.
 *
 * Phase 1 of the plan in `docs/COLOR_SWEEPER_BUILD_PLAN.md`: the five levels
 * that teach a child to *read* a board, on the one engine that asks reading
 * questions. Painting, deduction and proof are engines B and C, and the plan
 * holds the order they arrive in.
 *
 * A draft, so it reaches developers only. That is the correct state: nothing
 * here yet asks a child to solve anything.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/** Skill-owned artwork. Empty for now; the folder exists so the glob resolves. */
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

/**
 * What this skill says out loud.
 *
 * Empty, and deliberately so: no voice pass has been requested for this skill,
 * so every line takes the live TTS path. Registered rather than fetched so the
 * clip lookup can answer synchronously once clips do exist.
 */
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  {},
  manifestFields.id,
);

export const skill: Skill = {
  manifest: manifestFields as SkillManifest,
  features: features as SkillFeature[],
  settings: settings as Record<string, unknown>,
  settingsSchema: settingsSchema as Skill["settingsSchema"],
  lessons: lessonsJson.lessons as unknown as Lesson[],
  assets,

  activities: {
    neighbors: {
      id: "neighbors",
      name: "Neighbours and Clues",
      /*
       * Playable with nothing but a mode.
       *
       * `describeActivitySmoke` mounts every activity on these alone, so a
       * default that only half-configures a question surfaces as a crash in a
       * phase that never touched it. Board size, palette and anchors all have
       * engine-side defaults for that reason; a lesson narrows them.
       */
      defaultParams: { mode: "select_neighbors", questionsPerRound: 5 },
      component: neighbors.NeighborLens,
      worksheet: {
        build: neighbors.buildQuestion,
        prompt: neighbors.promptFor,
        printed: neighbors.printedFor,
        method: neighbors.methodFor,
        figure: neighbors.figureFor,
      },
    },
    board: {
      id: "board",
      name: "Colour the Board",
      /* All six generated board techniques ship with the engine, though only
         zero and full have lessons yet. Writing them together is what lets
         levels 9-14 arrive as JSON rather than as more components. */
      defaultParams: { mode: "zero", questionsPerRound: 3 },
      component: board.SweeperBoard,
      worksheet: {
        build: board.buildQuestion,
        prompt: board.promptFor,
        printed: board.printedFor,
        method: board.methodFor,
        figure: board.figureFor,
      },
    },
    reason: {
      id: "reason",
      name: "Give a Reason",
      /* Judging a deduction rather than making one. All three modes ship
         together; the two audit levels differ only in how many colours are on
         the board they are auditing. */
      defaultParams: { mode: "compare_clues", questionsPerRound: 5 },
      component: reason.ClueLab,
      worksheet: {
        build: reason.buildQuestion,
        prompt: reason.promptFor,
        printed: reason.printedFor,
        method: reason.methodFor,
        figure: reason.figureFor,
      },
    },
  },
};
