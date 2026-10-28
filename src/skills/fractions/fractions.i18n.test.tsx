import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { partWord, WHOLES, wholeName } from "./internal/data/fractionNumbers";
import { STRIP_REFUSALS } from "./internal/data/fractionStrip";
import { ROUTES } from "./activities/StrategyPicker";
import { buildStoryQuestion } from "./internal/data/fractionStory";

/** Fractions in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("fractions", {
  complete: ["km"],
  source: { dir: "src/skills/fractions", helper: "tf" },
});

const khmer = /[ក-៿]/;

describe("fractions in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("names parts, wholes, refusals and routes in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    expect(partWord(4)).toBe("ភាគបួន");
    expect(partWord(40, true)).toMatch(khmer);
    for (const whole of WHOLES) expect(wholeName(whole), whole.name).toMatch(khmer);
    expect(STRIP_REFUSALS["shade-more"]).toMatch(khmer);
    expect(ROUTES[0].label).toMatch(khmer);
    expect(buildStoryQuestion({}, "of_amount", 1).prompt).toMatch(khmer);

    PreferencesAPI.update({ language: "en" });
    expect(partWord(4)).toBe("quarter");
    expect(partWord(28)).toBe("twenty-eighth");
    expect(STRIP_REFUSALS["shade-more"]).toBe("Shade more of them — count how many the question asked for.");
  });

  it("reads every lesson's copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      expect(withLessonEdits("fractions", lesson).title, lesson.id).toMatch(khmer);
    }
  });

  it("draws a round in Khmer when Khmer is chosen", () => {
    PreferencesAPI.update({ language: "km" });
    for (const id of Object.keys(skill.activities)) {
      const h = renderActivity(skill.activities[id as keyof typeof skill.activities]);
      expect(document.body.textContent ?? "", id).toMatch(khmer);
      h.unmount();
    }
  });
});
