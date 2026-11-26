import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as pick from "./activities/PickOne";
import * as sort from "./activities/SortBins";
import * as order from "./activities/PutInOrder";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";

/**
 * Wonder Lab — real science for primary school, Grade 1 first.
 *
 * Three engines, each a way of thinking rather than a topic: `pick` (a
 * picture and a question, with misconceptions as the wrong answers), `sort`
 * (one thing at a time into the group it belongs to) and `order` (life stages
 * and sky patterns as a line of cards). Lessons choose a question set from
 * `internal/bank.ts`; every word is in `locales/`, so Khmer is a catalog, not
 * a code change. Everything is drawn and generated on the device — no network.
 */
const info = describeSkill(manifestJson, lessonsJson);

/** Lesson and unit icons, referenced as `science-living` and so on. */
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
    pick: {
      id: "pick",
      name: "Pick One",
      defaultParams: { set: "needs", questionsPerRound: 5 },
      component: pick.PickOne,
    },
    sort: {
      id: "sort",
      name: "Sort It",
      defaultParams: { set: "living", questionsPerRound: 8 },
      component: sort.SortBins,
    },
    order: {
      id: "order",
      name: "In Order",
      defaultParams: { set: "growth", questionsPerRound: 4 },
      component: order.PutInOrder,
    },
  },
};
