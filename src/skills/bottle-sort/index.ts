import type { Lesson, Skill, SkillFeature, SkillManifest } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as sort from "./activities/BottleSort";
import * as predict from "./activities/PredictThePour";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

// No `registerSkillArt`: bottles are geometry, not artwork. A body that grows
// with capacity cannot be a fixed SVG, and nothing else here is illustrated.
registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", { query: "?url", import: "default", eager: true }) as Record<string, string>,
  voiceJson.groups,
  manifestFields.id,
);

export const skill: Skill = {
  manifest: manifestFields as SkillManifest,
  features: features as SkillFeature[],
  settings: settings as Record<string, unknown>,
  settingsSchema: settingsSchema as Skill["settingsSchema"],
  lessons: lessonsJson.lessons as unknown as Lesson[],
  assets: [],
  activities: {
    sort: {
      id: "sort",
      name: "Bottle Sort",
      defaultParams: { spec: "one-pour", questionsPerRound: 3 },
      component: sort.BottleSort,
      worksheet: undefined,
    },
    // A second engine, because predicting a pour is scored from a picture the
    // child chooses rather than from a rack they build. Sharing the sorter
    // would have meant a mode flag that turns off everything the sorter is.
    predict: {
      id: "predict",
      name: "Which rack comes next?",
      defaultParams: { spec: "guess-the-result", questionsPerRound: 3 },
      component: predict.PredictThePour,
      worksheet: undefined,
    },
  },
};
