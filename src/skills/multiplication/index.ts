import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as groups from "./activities/GroupTray";
import * as array from "./activities/ArrayGrid";
import * as numberline from "./activities/SkipTrack";
import * as facts from "./activities/FactDeck";
import * as table from "./activities/TableGrid";
import * as factors from "./activities/FactorBoard";
import * as chart from "./activities/PlaceValueDesk";
import * as area from "./activities/AreaModel";
import * as column from "./activities/ColumnPad";
import * as estimate from "./activities/EstimateDial";
import * as story from "./activities/StoryBoard";
import * as strategy from "./activities/StrategyPicker";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Multiplication — fifty-six techniques on twelve engines.
 *
 * Built the way counting and addition are: metadata and curriculum in JSON,
 * only the activities in code. An engine takes its mode from a lesson parameter
 * and never asks which level it is, which is what lets most of this skill's
 * lessons ship as data rather than as components.
 *
 * All twelve engines. `docs/MULTIPLICATION_BUILD_PLAN.md` holds the phase
 * order they were built in and what each one owes the others.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/**
 * The things this skill asks a child to group and count.
 *
 * Its own rather than counting's or subtraction's: the ids in the shared
 * registry belong to the skill that registered them, and a family who disabled
 * another skill would otherwise take multiplication's objects away with it.
 */
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

/**
 * What this skill says out loud, registered at import time.
 *
 * Empty until someone runs `npm run voice:record`, which is the normal state
 * during the build and not a broken one: every line then takes the live TTS
 * path. Registered rather than fetched so `playClip` can answer synchronously.
 */
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  // No skill-scoped reactions: praise comes from the common pack, which names
  // no subject. `reactionPool` pools a skill's own with common's, so passing
  // none is a choice to use the shared voice, not a gap to fill later.
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
    groups: {
      id: "groups",
      name: "Equal Groups",
      /*
       * Playable on their own.
       *
       * `describeActivitySmoke` mounts every registered activity, and an engine
       * whose lessons have not been written yet is mounted with these alone —
       * so defaults that only half-configure a question would surface as a
       * crash in a phase that had not touched them.
       *
       * Deliberately no number ranges here: they belong to the mode, and a
       * range set on the activity is inherited by every mode a lesson later
       * chooses. `DEFAULTS` in GroupTray owns them, so `{ mode }` alone is a
       * complete, playable question.
       */
      defaultParams: { mode: "make_groups", questionsPerRound: 5 },
      component: groups.GroupTray,
      worksheet: {
        build: groups.buildQuestion,
        prompt: groups.promptFor,
        printed: groups.printedFor,
        method: groups.methodFor,
        figure: groups.figureFor,
      },
    },
    array: {
      id: "array",
      name: "Rows and Columns",
      /* All six modes ship now; `split_array` waits until level 33 for its
         lesson. Writing the engine complete is what lets that one arrive as
         JSON rather than as code. */
      defaultParams: { mode: "build_array", questionsPerRound: 5 },
      component: array.ArrayGrid,
      worksheet: {
        build: array.buildQuestion,
        prompt: array.promptFor,
        printed: array.printedFor,
        method: array.methodFor,
        figure: array.figureFor,
      },
    },
    numberline: {
      id: "numberline",
      name: "Hops on a Line",
      /* All four modes ship together. `count_multiples` is the only one whose
         apparatus differs — it hides the unmade landings, because a line
         already ticked in fives answers "is 27 a multiple of 5" by itself. */
      defaultParams: { mode: "skip_count", questionsPerRound: 5 },
      component: numberline.SkipTrack,
      worksheet: {
        build: numberline.buildQuestion,
        prompt: numberline.promptFor,
        printed: numberline.printedFor,
        method: numberline.methodFor,
        figure: numberline.figureFor,
      },
    },
    facts: {
      id: "facts",
      name: "Fact Deck",
      /* All ten modes ship now. Seven of them have no lesson until Phase 6,
         and writing them here is what lets those nine derived-fact lessons
         arrive as JSON rather than as nine more components. */
      defaultParams: { mode: "doubles", questionsPerRound: 5 },
      component: facts.FactDeck,
      worksheet: {
        build: facts.buildQuestion,
        prompt: facts.promptFor,
        printed: facts.printedFor,
        method: facts.methodFor,
        figure: facts.figureFor,
      },
    },
    table: {
      id: "table",
      name: "Times Table",
      /* The chart this engine owns is also what `times_table_chart` shows in
         fact lessons — which is why that feature waited for this phase rather
         than shipping a switch with nothing behind it. */
      defaultParams: { mode: "find_cell", questionsPerRound: 5 },
      component: table.TableGrid,
      worksheet: {
        build: table.buildQuestion,
        prompt: table.promptFor,
        printed: table.printedFor,
        method: table.methodFor,
        figure: table.figureFor,
      },
    },
    factors: {
      id: "factors",
      name: "Factor Board",
      /* Two of the four modes share one apparatus — ten numbers tried against a
         total — because finding every pair and deciding whether any pair exists
         are the same act. That is what lets level 37 be answered by a child who
         has never heard the word "prime". */
      defaultParams: { mode: "associative", questionsPerRound: 5 },
      component: factors.FactorBoard,
      worksheet: {
        build: factors.buildQuestion,
        prompt: factors.promptFor,
        printed: factors.printedFor,
        method: factors.methodFor,
        figure: factors.figureFor,
      },
    },
    chart: {
      id: "chart",
      name: "Place Value Desk",
      /* Three techniques that are one sentence with a different place in it:
         `34 × 10` is thirty-four tens, `3 × 40` is twelve tens, `30 × 40` is
         twelve hundreds. Nothing here ever adds a zero (§12 trap 5). */
      defaultParams: { mode: "times_ten_hundred", questionsPerRound: 5 },
      component: chart.PlaceValueDesk,
      worksheet: {
        build: chart.buildQuestion,
        prompt: chart.promptFor,
        printed: chart.printedFor,
        method: chart.methodFor,
        figure: chart.figureFor,
      },
    },
    area: {
      id: "area",
      name: "Area Model",
      /* The rectangle is never to true scale — 23 × 46 cannot be at 360px —
         but the pieces are ordered honestly, none may collapse, and every one
         carries its own label (§12 trap 10). */
      defaultParams: { mode: "rect_area", questionsPerRound: 5 },
      component: area.AreaModel,
      worksheet: {
        build: area.buildQuestion,
        prompt: area.promptFor,
        printed: area.printedFor,
        method: area.methodFor,
        figure: area.figureFor,
      },
    },
    column: {
      id: "column",
      name: "Column Method",
      /* The two-digit mode makes a child say what the second row multiplies by
         before it lets them write it. Answering with the bare digit is refused
         and explained — the placeholder zero is never a keystroke (§12 trap 12). */
      defaultParams: { mode: "no_regroup", questionsPerRound: 5 },
      component: column.ColumnPad,
      worksheet: {
        build: column.buildQuestion,
        prompt: column.promptFor,
        printed: column.printedFor,
        method: column.methodFor,
        figure: column.figureFor,
      },
    },
    estimate: {
      id: "estimate",
      name: "Estimate",
      /* Wrong claims are out by a whole place, never by one: an answer that is
         only just wrong cannot be judged by estimating, and offering it would
         teach computing under the name of estimation. */
      defaultParams: { mode: "round_estimate", questionsPerRound: 5 },
      component: estimate.EstimateDial,
      worksheet: {
        build: estimate.buildQuestion,
        prompt: estimate.promptFor,
        printed: estimate.printedFor,
        method: estimate.methodFor,
        figure: estimate.figureFor,
      },
    },
    story: {
      id: "story",
      name: "Story Problems",
      /* Six shapes over one fixed cast. Every comparison offers the additive
         misreading as an answer, because a round that never offers it has not
         tested the confusion level 53 exists to correct (§12 trap 15). */
      defaultParams: { mode: "equal_groups_total", questionsPerRound: 5 },
      component: story.StoryBoard,
      worksheet: {
        build: story.buildQuestion,
        prompt: story.promptFor,
        printed: story.printedFor,
        method: story.methodFor,
        figure: story.figureFor,
      },
    },
    strategy: {
      id: "strategy",
      name: "Choose a Route",
      /* The one level with no single right answer. Every route that genuinely
         fits is accepted; what is refused is a route whose move cannot be
         carried out on these two numbers, and the refusal says which. */
      defaultParams: { mode: "compare_paths", questionsPerRound: 6 },
      component: strategy.StrategyPicker,
      worksheet: {
        build: strategy.buildQuestion,
        prompt: strategy.promptFor,
        printed: strategy.printedFor,
        method: strategy.methodFor,
        figure: strategy.figureFor,
      },
    },
  },
};
