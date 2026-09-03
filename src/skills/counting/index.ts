import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as orbit from "./activities/TouchOrbit";
import * as subitize from "./activities/SubitizingRush";
import * as tenframe from "./activities/TenFrameRocket";
import * as numberline from "./activities/FroggySkip";
import * as base10 from "./activities/Base10Foundry";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

/**
 * Counting — the reference skill.
 *
 * Metadata and curriculum are JSON so they can be edited, exported and (later)
 * served without a rebuild. Only the activities are code.
 *
 * Five activities, not one: each is a way of counting rather than a level
 * number, so a lesson picks the one it wants and the activity never asks which
 * level it is. This replaced a single fifteen-level component whose state, judge
 * and render for level 15 were in scope while level 1 played.
 */
const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

/**
 * The countable objects this skill draws with, registered at import time.
 *
 * They live in `./assets` rather than the app's shared collection because they
 * are counting's, not the app's: eight things chosen so that no two share a
 * silhouette and all carry the same optical weight, which is what stops the
 * artwork varying the difficulty of a counting question. Art that general
 * furniture happens to need still belongs in `src/assets/svg`.
 *
 * Referenced as `counting-rocket` — see `assets/svg/skillArt.ts` for why the
 * ids are namespaced that way.
 */
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

/**
 * This skill's recorded voice lines, registered at import time.
 *
 * The words it says are its own, the way its artwork is: `audio/manifest.json`
 * and the clips beside it are written by `npm run voice:record`, which reads the
 * phrases out of `voice.json` and `lessons.json`.
 *
 * Registered rather than fetched so `playClip` can answer synchronously — a tap
 * has to make a sound without waiting on a request, which is the entire reason
 * these recordings exist.
 *
 * An empty manifest is the normal state before anyone has run the recorder: every
 * line then takes the live TTS path exactly as it did before.
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
    orbit: {
      id: "orbit",
      name: "Touch and Count",
      defaultParams: { mode: "row", questionsPerRound: 5 },
      component: orbit.TouchOrbit,
      worksheet: { build: orbit.buildQuestion, prompt: orbit.promptFor, printed: orbit.printedFor, method: orbit.methodFor, figure: orbit.figureFor },
    },
    subitize: {
      id: "subitize",
      name: "Subitizing Rush",
      defaultParams: { display: "grid", questionsPerRound: 5 },
      component: subitize.SubitizingRush,
      worksheet: { build: subitize.buildQuestion, prompt: subitize.promptFor, printed: subitize.printedFor },
    },
    tenframe: {
      id: "tenframe",
      name: "Ten-Frame Rocket",
      defaultParams: { mode: "fill", questionsPerRound: 5 },
      component: tenframe.TenFrameRocket,
      worksheet: { build: tenframe.buildQuestion, prompt: tenframe.promptFor, printed: tenframe.printedFor, method: tenframe.methodFor, figure: tenframe.figureFor },
    },
    numberline: {
      id: "numberline",
      name: "Froggy Skip",
      defaultParams: { mode: "hop", questionsPerRound: 5 },
      component: numberline.FroggySkip,
      worksheet: { build: numberline.buildQuestion, prompt: numberline.promptFor, printed: numberline.printedFor, method: numberline.methodFor, figure: numberline.figureFor },
    },
    base10: {
      id: "base10",
      name: "Base-10 Foundry",
      defaultParams: { targetRange: [11, 35], bundleOnes: true, questionsPerRound: 5 },
      component: base10.Base10Foundry,
      worksheet: { build: base10.buildQuestion, prompt: base10.promptFor, printed: base10.printedFor, method: base10.methodFor, figure: base10.figureFor },
    },
  },
};
