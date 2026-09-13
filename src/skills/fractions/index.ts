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
import * as divide from "./activities/ShareOut";
import * as decimal from "./activities/DecimalBridge";
import * as estimate from "./activities/EstimateDial";
import * as story from "./activities/StoryBoard";
import * as strategy from "./activities/StrategyPicker";
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
      worksheet: { build: strip.buildQuestion, prompt: strip.promptFor, printed: strip.printedFor, method: strip.methodFor, figure: strip.figureFor },
    },
    numberline: {
      id: "numberline",
      name: "On the Line",
      defaultParams: { mode: "place_unit", questionsPerRound: 5 },
      component: numberline.FractionLine,
      worksheet: { build: numberline.buildQuestion, prompt: numberline.promptFor, printed: numberline.printedFor, method: numberline.methodFor, figure: numberline.figureFor },
    },
    equivalence: {
      id: "equivalence",
      name: "Same Amount, New Name",
      defaultParams: { mode: "split", questionsPerRound: 5 },
      component: equivalence.EquivalenceMill,
      worksheet: { build: equivalence.buildQuestion, prompt: equivalence.promptFor, printed: equivalence.printedFor, method: equivalence.methodFor, figure: equivalence.figureFor },
    },
    compare: {
      id: "compare",
      name: "Which Is More?",
      defaultParams: { mode: "same_denominator", questionsPerRound: 5 },
      component: compare.CompareBar,
      worksheet: { build: compare.buildQuestion, prompt: compare.promptFor, printed: compare.printedFor, method: compare.methodFor, figure: compare.figureFor },
    },
    mixed: {
      id: "mixed",
      name: "Wholes and Parts",
      defaultParams: { mode: "to_mixed", questionsPerRound: 5 },
      component: mixed.MixedBoard,
      worksheet: { build: mixed.buildQuestion, prompt: mixed.promptFor, printed: mixed.printedFor, method: mixed.methodFor, figure: mixed.figureFor },
    },
    add: {
      id: "add",
      name: "Adding Pieces",
      defaultParams: { mode: "add_like", questionsPerRound: 5 },
      component: add.AddStrip,
      worksheet: { build: add.buildQuestion, prompt: add.promptFor, printed: add.printedFor, method: add.methodFor, figure: add.figureFor },
    },
    multiply: {
      id: "multiply",
      name: "A Fraction of Something",
      defaultParams: { mode: "of_whole", questionsPerRound: 5 },
      component: multiply.AreaGrid,
      worksheet: { build: multiply.buildQuestion, prompt: multiply.promptFor, printed: multiply.printedFor, method: multiply.methodFor, figure: multiply.figureFor },
    },
    divide: {
      id: "divide",
      name: "How Many Fit?",
      defaultParams: { mode: "measure", questionsPerRound: 5 },
      component: divide.ShareOut,
      worksheet: { build: divide.buildQuestion, prompt: divide.promptFor, printed: divide.printedFor, method: divide.methodFor, figure: divide.figureFor },
    },
    decimal: {
      id: "decimal",
      name: "One Number, Three Names",
      defaultParams: { mode: "tenths", questionsPerRound: 5 },
      component: decimal.DecimalBridge,
      worksheet: { build: decimal.buildQuestion, prompt: decimal.promptFor, printed: decimal.printedFor, method: decimal.methodFor, figure: decimal.figureFor },
    },
    estimate: {
      id: "estimate",
      name: "Roughly How Much?",
      defaultParams: { mode: "benchmark", questionsPerRound: 6 },
      component: estimate.EstimateDial,
      worksheet: { build: estimate.buildQuestion, prompt: estimate.promptFor, printed: estimate.printedFor, method: estimate.methodFor, figure: estimate.figureFor },
    },
    story: {
      id: "story",
      name: "In Words",
      defaultParams: { mode: "of_amount", questionsPerRound: 5 },
      component: story.StoryBoard,
      worksheet: { build: story.buildQuestion, prompt: story.promptFor, printed: story.printedFor, method: story.methodFor, figure: story.figureFor },
    },
    strategy: {
      id: "strategy",
      name: "Which Way?",
      defaultParams: { questionsPerRound: 5 },
      component: strategy.StrategyPicker,
      worksheet: { build: strategy.buildQuestion, prompt: strategy.promptFor, printed: strategy.printedFor, method: strategy.methodFor },
    },
  },
};
