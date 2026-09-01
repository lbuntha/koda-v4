import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import { CountTray } from "./activities/CountTray";
import { FrameFill } from "./activities/FrameFill";
import { BondTree } from "./activities/BondTree";
import { JumpLine } from "./activities/JumpLine";
import { BlockYard } from "./activities/BlockYard";
import { PlaceValueDesk } from "./activities/PlaceValueDesk";
import { FactDeck } from "./activities/FactDeck";
import { ChainBoard } from "./activities/ChainBoard";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

/**
 * Addition — fifty-two techniques on twelve engines.
 *
 * Built the way counting is: metadata and curriculum in JSON, only the
 * activities in code. An engine takes its mode from a lesson parameter and
 * never asks which level it is, which is what lets most of this skill's
 * lessons ship as data rather than as components.
 *
 * One engine so far. `docs/ADDITION_BUILD_PLAN.md` holds the phase order and
 * the other eleven.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/**
 * The things this skill asks a child to count and combine.
 *
 * Its own, rather than counting's: the ids in the shared registry belong to the
 * skill that registered them, and a family who disabled counting would
 * otherwise take addition's objects away with it.
 */
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

/**
 * What this skill says out loud, registered at import time.
 *
 * Empty until someone runs `npm run voice:record` — which is the normal state
 * during the build, and not a broken one: every line then takes the live TTS
 * path. Registered rather than fetched so `playClip` can answer synchronously;
 * a tap has to make a sound without waiting on a request.
 */
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  voiceJson.groups,
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
    tray: {
      id: "tray",
      name: "Count and Combine",
      /**
       * Playable on their own.
       *
       * `describeActivitySmoke` mounts every registered activity, and an engine
       * whose lessons have not been written yet is mounted with these alone —
       * so defaults that only half-configure a question would fail as a crash
       * in a phase that had not touched them.
       */
      /*
       * Deliberately no number ranges here.
       *
       * They belong to the mode, and a range on the activity is inherited by
       * every mode a lesson later chooses — which is how Adding One's declared
       * range of 1 to 15 silently became 1 to 9 under count-all's `sumMax`.
       * `DEFAULT_SPEC` in CountTray owns them, so `{ mode }` alone is a
       * complete, playable question.
       */
      defaultParams: { mode: "count_all", questionsPerRound: 5 },
      component: CountTray,
    },
    frames: {
      id: "frames",
      name: "Five and Ten Frames",
      /* All four modes ship now; `make_five` and `make_ten` wait nine levels
         for their lessons. Writing an engine complete is what lets those two
         arrive as JSON rather than as code. */
      defaultParams: { mode: "ten", questionsPerRound: 5 },
      component: FrameFill,
    },
    bonds: {
      id: "bonds",
      name: "Number Bonds",
      defaultParams: { mode: "whole_unknown", questionsPerRound: 5 },
      component: BondTree,
    },
    numberline: {
      id: "numberline",
      name: "Number Line Jumps",
      /* Six modes across two kinds of line. `bridge_ten` onwards wait eight
         levels for their lessons and arrive as JSON. */
      defaultParams: { mode: "path", questionsPerRound: 5 },
      component: JumpLine,
    },
    base10: {
      id: "base10",
      name: "Base-Ten Blocks",
      defaultParams: { mode: "build_add", questionsPerRound: 5 },
      component: BlockYard,
    },
    chart: {
      id: "chart",
      name: "Place-Value Chart",
      defaultParams: { mode: "chart_add", questionsPerRound: 5 },
      component: PlaceValueDesk,
    },
    facts: {
      id: "facts",
      name: "Fact Deck",
      defaultParams: { mode: "doubles", questionsPerRound: 5 },
      component: FactDeck,
    },
    multi: {
      id: "multi",
      name: "Chains and Pairs",
      defaultParams: { mode: "pairs", questionsPerRound: 5 },
      component: ChainBoard,
    },
  },
};
