import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { COMPARE_MODES } from "./internal/compare";
import { buildCompareQuestion, compareHints, nameOf } from "./activities/CompareBench";
import { compareDemoSteps, orderDemoSteps } from "./activities/CompareDemo";
import { BALANCE_MODES } from "./internal/balance";
import { CAPACITY_MODES } from "./internal/capacity";
import { balanceHints, buildBalanceQuestion } from "./activities/BalanceBeam";
import { buildCapacityQuestion, capacityHints } from "./activities/PourLab";
import { balanceDemoSteps, jugDemoSteps, pourDemoSteps, unitsDemoSteps } from "./activities/MeasureDemos";
import { TRACK_MODES } from "./internal/track";
import { RULER_MODES } from "./internal/ruler";
import { SCALE_MODES } from "./internal/scale";
import { THERMO_MODES } from "./internal/thermo";
import { buildScaleQuestion, scaleDemoSteps, scaleHints } from "./activities/DialScale";
import { buildThermoQuestion, thermoDemoSteps, thermoHints } from "./activities/Thermometer";
import { buildStoryQuestion, storyDemoSteps, storyHints } from "./activities/MeasureStory";
import { ESTIMATE_MODES } from "./internal/estimate";
import { buildRulerQuestion, rulerHints } from "./activities/RulerDesk";
import { rulerDemoSteps } from "./activities/RulerDemo";
import { buildEstimateQuestion, estimateDemoSteps, estimateHints } from "./activities/EstimateCards";
import { buildTrackQuestion, trackHints } from "./activities/UnitTrack";

/** Measure It in Khmer: every engine line and every lesson's copy, translated. */
describeSkillLocales("measurement", {
  complete: ["km"],
  source: { dir: "src/skills/measurement", helper: "tx" },
});

const khmer = /[ក-៿]/;
const latin = /[A-Za-z]/;

describe("Measure It in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words every prompt, hint and name in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    for (const mode of COMPARE_MODES) {
      for (let i = 1; i <= 10; i += 1) {
        const q = buildCompareQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(q.prompt, `${mode}: ${q.prompt}`).not.toMatch(latin);
        for (const rung of compareHints(q.q)) expect(rung, mode).not.toMatch(latin);
        for (const item of q.q.items) expect(nameOf(item)).not.toMatch(latin);
      }
    }
    for (const step of [...compareDemoSteps(), ...orderDemoSteps()]) expect(step.caption).toMatch(khmer);
  });

  it("words the balance and water engines in Khmer; only unit symbols like ml stay Latin", () => {
    PreferencesAPI.update({ language: "km" });
    const latinExceptUnits = (line: string) => line.replace(/\b(ml|mL|cm|mm|km|m|in|ft|g|kg|l|L|lb|oz)\b|°[CF]/g, "").match(/[A-Za-z]/);
    for (const mode of BALANCE_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildBalanceQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of balanceHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of CAPACITY_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildCapacityQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of capacityHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of TRACK_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildTrackQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of trackHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of RULER_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildRulerQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of rulerHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of ESTIMATE_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildEstimateQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of estimateHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of SCALE_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildScaleQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        for (const rung of scaleHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (const mode of THERMO_MODES) {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildThermoQuestion({ mode }, i);
        expect(q.prompt, mode).toMatch(khmer);
        expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
        for (const rung of thermoHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
      }
    }
    for (let i = 1; i <= 12; i += 1) {
      const q = buildStoryQuestion({}, i);
      expect(q.prompt).toMatch(khmer);
      expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
      for (const rung of storyHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
    }
    for (let i = 1; i <= 12; i += 1) {
      const q = buildEstimateQuestion({ mode: "choose_unit", quantity: "mass_capacity" }, i);
      expect(latinExceptUnits(q.prompt!), q.prompt).toBeNull();
      for (const rung of estimateHints(q.q)) expect(latinExceptUnits(rung), rung).toBeNull();
    }
    for (const step of [...scaleDemoSteps(), ...thermoDemoSteps(), ...storyDemoSteps()]) expect(step.caption).toMatch(khmer);
    const rulerDemos = (["read", "place", "draw"] as const).flatMap((d) => rulerDemoSteps(d));
    for (const step of [...balanceDemoSteps(), ...pourDemoSteps(), ...jugDemoSteps(), ...unitsDemoSteps(), ...rulerDemos, ...estimateDemoSteps()])
      expect(step.caption).toMatch(khmer);
  });

  it("puts the colour after the thing in Khmer, before it in English", () => {
    const item = { key: "a", colour: "blue" as const, thing: "pencil" as const, size: 5, start: 0 };
    PreferencesAPI.update({ language: "km" });
    expect(nameOf(item)).toBe("ខ្មៅដៃពណ៌ខៀវ");
    PreferencesAPI.update({ language: "en" });
    expect(nameOf(item)).toBe("the blue pencil");
  });

  it("reads every lesson's title, tip and steps from the Khmer catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      const shown = withLessonEdits("measurement", lesson);
      expect(shown.title, lesson.id).toMatch(khmer);
      const play = (shown.params as { play: { kidTip: string; audioPrompt: string; stepByStep: string[] } }).play;
      // Practice has no tip and says nothing: both stay empty in every language.
      const practising = Boolean((lesson.params as { question: { practice?: boolean } }).question.practice);
      expect(play.kidTip, lesson.id).toMatch(practising ? /^$/ : khmer);
      expect(play.audioPrompt, lesson.id).toMatch(practising ? /^$/ : khmer);
      for (const step of play.stepByStep) expect(step, lesson.id).toMatch(khmer);
    }
  });
});
