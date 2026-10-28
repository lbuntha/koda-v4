import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { STRATEGIES } from "./internal/data/strategyPool";
import { castFor, count } from "./internal/data/storyCast";
import { numberWord, PLACE_NAMES } from "./internal/data/multiplicationNumbers";

/** Multiplication in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("multiplication", {
  complete: ["km"],
  source: { dir: "src/skills/multiplication", helper: "tm" },
});

const khmer = /[ក-៿]/;

describe("multiplication in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("reads strategies, stories and numbers in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    for (const strategy of STRATEGIES) expect(strategy.label, strategy.id).toMatch(khmer);
    const cast = castFor("km-test");
    expect(cast.actor).toMatch(khmer);
    expect(count(3, cast.item)).toMatch(khmer);
    expect(numberWord(7)).toBe("ប្រាំពីរ");
    expect(PLACE_NAMES[10]).toMatch(khmer);

    PreferencesAPI.update({ language: "en" });
    expect(numberWord(7)).toBe("seven");
    expect(PLACE_NAMES[10]).toBe("tens");
  });

  it("reads every lesson's copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      expect(withLessonEdits("multiplication", lesson).title, lesson.id).toMatch(khmer);
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
