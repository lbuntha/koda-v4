import type { Skill } from "../types";
import { describeSkill } from "../describe";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as compare from "./activities/CompareBench";
import * as balance from "./activities/BalanceBeam";
import * as capacity from "./activities/PourLab";
import * as units from "./activities/UnitTrack";
import * as ruler from "./activities/RulerDesk";
import * as estimate from "./activities/EstimateCards";
import * as scale from "./activities/DialScale";
import * as thermo from "./activities/Thermometer";
import * as story from "./activities/MeasureStory";
import { SHEETS } from "./activities/sheets";
import { registerSkillVoice } from "../../lib/voiceClips";
import { registerSkillArt } from "../../assets/svg/skillArt";
import audioManifest from "./audio/manifest.json";

/**
 * Measure It — every kind of measuring a primary school teaches, for the US,
 * UK and Cambodian curricula (docs/MEASUREMENT_BUILD_PLAN.md).
 *
 * Built phase by phase. Engines so far: `compare` (longer, taller, in order, on
 * a string, which tool), `balance` (heavier on a pan balance, balancing with
 * cubes) and `capacity` (pour into cups, read and fill a measuring jug, US cups
 * to gallons) and `units` (measuring with blocks, spotting gaps, cubes or rods), `ruler`
 * (cm, mm and inch rulers, broken rulers, number lines) and `estimate` (the
 * sensible unit and the sensible amount), `scale` (round kitchen, bathroom and
 * pound scales), `thermo` (°C, below zero, changes, °F) and `story` (word
 * problems with measures). Every question is drawn fresh on the device within the
 * lesson's limits, so it works offline and never repeats inside a round.
 */
const info = describeSkill(manifestJson, lessonsJson);

/** Lesson and unit icons, referenced as `measurement-compare` and so on. */
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
    compare: {
      id: "compare",
      name: "Compare Bench",
      defaultParams: { mode: "pick", questionsPerRound: 5 },
      component: compare.CompareBench,
      worksheet: undefined,
    },
    balance: {
      id: "balance",
      name: "Balance Beam",
      defaultParams: { mode: "compare", questionsPerRound: 5 },
      component: balance.BalanceBeam,
      worksheet: undefined,
    },
    capacity: {
      id: "capacity",
      name: "Pour Lab",
      defaultParams: { mode: "pour", questionsPerRound: 5 },
      component: capacity.PourLab,
      worksheet: SHEETS.capacity,
    },
    units: {
      id: "units",
      name: "Unit Track",
      defaultParams: { mode: "lay", questionsPerRound: 5 },
      component: units.UnitTrack,
      worksheet: undefined,
    },
    ruler: {
      id: "ruler",
      name: "Ruler Desk",
      defaultParams: { mode: "read", questionsPerRound: 5 },
      component: ruler.RulerDesk,
      worksheet: SHEETS.ruler,
    },
    estimate: {
      id: "estimate",
      name: "Estimate Cards",
      defaultParams: { mode: "choose_unit", questionsPerRound: 5 },
      component: estimate.EstimateCards,
      worksheet: SHEETS.estimate,
    },
    scale: {
      id: "scale",
      name: "Dial Scale",
      defaultParams: { mode: "read", questionsPerRound: 5 },
      component: scale.DialScale,
      worksheet: SHEETS.scale,
    },
    thermo: {
      id: "thermo",
      name: "Thermometer",
      defaultParams: { mode: "read", questionsPerRound: 5 },
      component: thermo.Thermometer,
      worksheet: SHEETS.thermo,
    },
    story: {
      id: "story",
      name: "Measure Story",
      defaultParams: { mode: "same_unit", questionsPerRound: 5 },
      component: story.MeasureStory,
      worksheet: SHEETS.story,
    },
  },
};
