import type { Lesson, SkillFeature, SkillManifest, Skill } from "../types";
import manifestJson from "./manifest.json";
import lessonsJson from "./lessons.json";
import * as tray from "./activities/RemoveTray";
import * as frames from "./activities/FrameTakeaway";
import * as bonds from "./activities/BondHouse";
import * as numberline from "./activities/DifferenceLine";
import * as facts from "./activities/FactDeck";
import * as base10 from "./activities/BlockExchange";
import * as chart from "./activities/PlaceValueDesk";
import * as column from "./activities/ColumnPad";
import * as estimate from "./activities/EstimateDial";
import * as story from "./activities/StoryBoard";
import * as strategy from "./activities/StrategyPicker";
import { registerSkillArt } from "../../assets/svg/skillArt";
import { registerSkillVoice } from "../../lib/voiceClips";
import audioManifest from "./audio/manifest.json";
import voiceJson from "./voice.json";

const { features, settings, settingsSchema, ...manifestFields } = manifestJson;

const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>);

registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url", import: "default", eager: true,
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
      name: "Take Away and Compare",
      defaultParams: { mode: "remove", questionsPerRound: 5 },
      component: tray.RemoveTray,
      worksheet: {
        build: tray.buildQuestion,
        prompt: tray.promptFor,
        printed: tray.printedFor,
        method: tray.methodFor,
      },
    },
    frames: {
      id: "frames",
      name: "Five and Ten Frame Takeaway",
      defaultParams: { mode: "ten", questionsPerRound: 5 },
      component: frames.FrameTakeaway,
      worksheet: {
        build: frames.buildQuestion,
        prompt: frames.promptFor,
        printed: frames.printedFor,
        method: frames.methodFor,
        figure: frames.figureFor,
      },
    },
    bonds: {
      id: "bonds",
      name: "Subtraction Number Bonds",
      defaultParams: { mode: "part_unknown", questionsPerRound: 5 },
      component: bonds.BondHouse,
      worksheet: {
        build: bonds.buildQuestion,
        prompt: bonds.promptFor,
        printed: bonds.printedFor,
        method: bonds.methodFor,
        figure: bonds.figureFor,
      },
    },
    numberline: {
      id: "numberline",
      name: "Subtraction Number Lines",
      defaultParams: { mode: "path_back", questionsPerRound: 5 },
      component: numberline.DifferenceLine,
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
      name: "Subtraction Fact Relationships",
      defaultParams: { mode: "family", questionsPerRound: 5 },
      component: facts.FactDeck,
      worksheet: {
        build: facts.buildQuestion,
        prompt: facts.promptFor,
        printed: facts.printedFor,
        method: facts.methodFor,
      },
    },
    base10: {
      id: "base10",
      name: "Base-Ten Block Exchange",
      defaultParams: { mode: "build_subtract", questionsPerRound: 5 },
      component: base10.BlockExchange,
      worksheet: {
        build: base10.buildQuestion,
        prompt: base10.promptFor,
        printed: base10.printedFor,
        method: base10.methodFor,
        figure: base10.figureFor,
      },
    },
    strategy: {
      id: "strategy",
      name: "Choose a Strategy",
      defaultParams: { mode: "compare_paths", questionsPerRound: 5 },
      component: strategy.StrategyPicker,
      worksheet: {
        build: strategy.buildQuestion,
        prompt: strategy.promptFor,
        printed: strategy.printedFor,
        method: strategy.methodFor,
      },
    },
    story: {
      id: "story",
      name: "Subtraction Stories",
      defaultParams: { mode: "remove_result", questionsPerRound: 5 },
      component: story.StoryBoard,
      worksheet: {
        build: story.buildQuestion,
        prompt: story.promptFor,
        printed: story.printedFor,
        method: story.methodFor,
        figure: story.figureFor,
      },
    },
    estimate: {
      id: "estimate",
      name: "Estimate and Judge",
      defaultParams: { mode: "round_estimate", questionsPerRound: 5 },
      component: estimate.EstimateDial,
      worksheet: {
        build: estimate.buildQuestion,
        prompt: estimate.promptFor,
        printed: estimate.printedFor,
        method: estimate.methodFor,
      },
    },
    column: {
      id: "column",
      name: "Column Subtraction",
      defaultParams: { mode: "standard", questionsPerRound: 5 },
      component: column.ColumnPad,
      worksheet: {
        build: column.buildQuestion,
        prompt: column.promptFor,
        printed: column.printedFor,
        method: column.methodFor,
        figure: column.figureFor,
      },
    },
    chart: {
      id: "chart",
      name: "Place Value Desk",
      defaultParams: { mode: "chart_subtract", questionsPerRound: 5 },
      component: chart.PlaceValueDesk,
      worksheet: {
        build: chart.buildQuestion,
        prompt: chart.promptFor,
        printed: chart.printedFor,
        method: chart.methodFor,
        figure: chart.figureFor,
      },
    },
  },
};
