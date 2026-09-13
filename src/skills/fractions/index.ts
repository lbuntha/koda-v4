import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as strip from "./activities/FoldStrip";
import * as numberline from "./activities/FractionLine";
import * as equivalence from "./activities/EquivalenceMill";
import * as compare from "./activities/CompareBar";
import * as mixed from "./activities/MixedBoard";
import * as add from "./activities/AddStrip";
import * as multiply from "./activities/AreaGrid";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Fractions — equal parts of a whole somebody named.
 *
 * Built the way counting, addition, multiplication and division are: metadata
 * and curriculum in JSON, only the activities in code.
 *
 * `docs/FRACTIONS_BUILD_PLAN.md` holds the phase order and the twelve engines.
 * The two things to know before reading any of it: a fraction is built from
 * copies of its unit fraction — `3/4` is three of `1/4`, not a 3 and a 4 — and
 * every question names its whole, because half a pizza is not half a stadium.
 * See `internal/data/fractionNumbers.ts`.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/**
 * This skill's recorded voice lines, registered at import time.
 *
 * `voice.json` sets `speaksPrompts: false`: nothing is read aloud when a round
 * opens, because a child of eight can read and reading a word problem to them
 * takes the reading out of it. Only the refusals are recorded, and recording is
 * a separate job from building.
 */
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  // No skill-scoped reactions: praise comes from the common pack, which names no
  // subject. Passing none is a choice to use the shared voice, not a gap.
  {},
  manifestFields.id,
);

export const skill: Skill = {
  manifest: manifestFields as SkillManifest,
  features: features as SkillFeature[],
  settings: settings as Record<string, unknown>,
  settingsSchema: settingsSchema as Skill["settingsSchema"],
  lessons: lessonsJson.lessons as unknown as Lesson[],

  activities: {
    strip: {
      id: "strip",
      name: "Equal Parts",
      defaultParams: { mode: "name_unit", questionsPerRound: 5 },
      component: strip.FoldStrip,
    },
    numberline: {
      id: "numberline",
      name: "On the Line",
      defaultParams: { mode: "place_unit", questionsPerRound: 5 },
      component: numberline.FractionLine,
    },
    equivalence: {
      id: "equivalence",
      name: "Same Amount, New Name",
      defaultParams: { mode: "split", questionsPerRound: 5 },
      component: equivalence.EquivalenceMill,
    },
    compare: {
      id: "compare",
      name: "Which Is More?",
      defaultParams: { mode: "same_denominator", questionsPerRound: 5 },
      component: compare.CompareBar,
    },
    mixed: {
      id: "mixed",
      name: "Wholes and Parts",
      defaultParams: { mode: "to_mixed", questionsPerRound: 5 },
      component: mixed.MixedBoard,
    },
    add: {
      id: "add",
      name: "Adding Pieces",
      defaultParams: { mode: "add_like", questionsPerRound: 5 },
      component: add.AddStrip,
    },
    multiply: {
      id: "multiply",
      name: "A Fraction of Something",
      defaultParams: { mode: "of_whole", questionsPerRound: 5 },
      component: multiply.AreaGrid,
    },
  },
};
