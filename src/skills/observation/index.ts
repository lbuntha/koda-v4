import type { Lesson, Skill, SkillFeature, SkillManifest } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as hunt from "./activities/ObjectHunt";
import * as spot from "./activities/SpotTheDifference";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

const { features, settings, settingsSchema, ...manifestFields } = manifestJson;
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>);

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
  assets,
  activities: {
    "object-hunt": {
      id: "object-hunt",
      name: "Hidden Object Hunt",
      defaultParams: { mode: "exact", sceneId: "beach-sandcastle-shore", objectCount: 6, targetCount: 1, questionsPerRound: 5 },
      component: hunt.ObjectHunt,
      worksheet: { build: hunt.buildQuestion, prompt: hunt.promptFor, printed: hunt.printedFor },
    },
    "spot-the-difference": {
      id: "spot-the-difference",
      name: "Spot the Difference",
      defaultParams: { sceneId: "beach-sandcastle-shore", objectCount: 8, differenceCount: 3, kinds: ["missing", "moved"], questionsPerRound: 5 },
      component: spot.SpotTheDifference,
      worksheet: { build: spot.buildQuestion, prompt: spot.promptFor, printed: spot.printedFor },
    },
  },
};
