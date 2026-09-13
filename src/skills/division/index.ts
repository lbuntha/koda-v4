import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as share from "./activities/ShareTray";
import * as array from "./activities/ArrayDivide";
import * as numberline from "./activities/HopBack";
import * as facts from "./activities/FactDeck";
import * as remainder from "./activities/RemainderYard";
import * as chart from "./activities/PlaceValueDesk";
import * as chunk from "./activities/ChunkPad";
import * as column from "./activities/DivisionPad";
import * as factors from "./activities/FactorLab";
import * as estimate from "./activities/EstimateDial";
import * as story from "./activities/StoryBoard";
import * as strategy from "./activities/StrategyPicker";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Division — sharing out, grouping up, and the bit left over.
 *
 * Built the way counting, addition and multiplication are: metadata and
 * curriculum in JSON, only the activities in code. An engine takes its mode from
 * a lesson parameter and never asks which level it is.
 *
 * `docs/DIVISION_BUILD_PLAN.md` holds the phase order, the twelve engines and
 * what each one owes the others. The one thing to know before reading any of it:
 * `12 ÷ 3` is two different questions — three groups of four, or four groups of
 * three — and every question this skill draws carries which one it is. See
 * `internal/data/divisionNumbers.ts`.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/**
 * This skill's recorded voice lines, registered at import time.
 *
 * `voice.json` is a script; the recordings are made separately and later. Until
 * they exist, `audio/manifest.json` is empty and every line takes the live TTS
 * path — which is the normal state for the whole of this skill's construction,
 * not a gap to fill per phase.
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
    share: {
      id: "share",
      name: "Share It Out",
      defaultParams: { mode: "share_out", questionsPerRound: 5 },
      component: share.ShareTray,
      worksheet: { build: share.buildQuestion, prompt: share.promptFor, printed: share.printedFor, method: share.methodFor, figure: share.figureFor },
    },
    array: {
      id: "array",
      name: "The Array Knows",
      defaultParams: { mode: "total_and_side", questionsPerRound: 5 },
      component: array.ArrayDivide,
      worksheet: { build: array.buildQuestion, prompt: array.promptFor, printed: array.printedFor, method: array.methodFor, figure: array.figureFor },
    },
    numberline: {
      id: "numberline",
      name: "Hop Back",
      defaultParams: { mode: "back_to_zero", questionsPerRound: 5 },
      component: numberline.HopBack,
      worksheet: { build: numberline.buildQuestion, prompt: numberline.promptFor, printed: numberline.printedFor, method: numberline.methodFor, figure: numberline.figureFor },
    },
    facts: {
      id: "facts",
      name: "Facts You Know",
      defaultParams: { mode: "easy_divisors", questionsPerRound: 5 },
      component: facts.FactDeck,
      worksheet: { build: facts.buildQuestion, prompt: facts.promptFor, printed: facts.printedFor, method: facts.methodFor, figure: facts.figureFor },
    },
    remainder: {
      id: "remainder",
      name: "What Is Left",
      defaultParams: { mode: "record", questionsPerRound: 5 },
      component: remainder.RemainderYard,
      worksheet: { build: remainder.buildQuestion, prompt: remainder.promptFor, printed: remainder.printedFor, method: remainder.methodFor },
    },
    chart: {
      id: "chart",
      name: "Place by Place",
      defaultParams: { mode: "split_exact", questionsPerRound: 5 },
      component: chart.PlaceValueDesk,
      worksheet: { build: chart.buildQuestion, prompt: chart.promptFor, printed: chart.printedFor, method: chart.methodFor },
    },
    chunk: {
      id: "chunk",
      name: "Take Away Chunks",
      defaultParams: { mode: "chunks", questionsPerRound: 5 },
      component: chunk.ChunkPad,
      worksheet: { build: chunk.buildQuestion, prompt: chunk.promptFor, printed: chunk.printedFor, method: chunk.methodFor },
    },
    column: {
      id: "column",
      name: "The Written Method",
      defaultParams: { mode: "short_exact", questionsPerRound: 5 },
      component: column.DivisionPad,
      worksheet: { build: column.buildQuestion, prompt: column.promptFor, printed: column.printedFor, method: column.methodFor },
    },
    factors: {
      id: "factors",
      name: "Does It Go?",
      defaultParams: { mode: "last_digit", questionsPerRound: 6 },
      component: factors.FactorLab,
      worksheet: { build: factors.buildQuestion, prompt: factors.promptFor, printed: factors.printedFor, method: factors.methodFor },
    },
    estimate: {
      id: "estimate",
      name: "About How Much?",
      defaultParams: { mode: "compatible", questionsPerRound: 5 },
      component: estimate.EstimateDial,
      worksheet: { build: estimate.buildQuestion, prompt: estimate.promptFor, printed: estimate.printedFor, method: estimate.methodFor },
    },
    story: {
      id: "story",
      name: "In Words",
      defaultParams: { mode: "size_unknown", questionsPerRound: 5 },
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
