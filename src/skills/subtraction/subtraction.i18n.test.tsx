import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { numberWord } from "./internal/data/subtractionNumbers";
import { STRATEGY_CARDS } from "./internal/data/strategyCards";
import { CAST } from "./internal/data/storyCast";

/** Subtraction in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("subtraction", {
  complete: ["km"],
  source: { dir: "src/skills/subtraction", helper: "ts" },
});

describe("subtraction in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("names strategies, the cast and numbers in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    expect(STRATEGY_CARDS[0].name).toBe("រាប់ថយក្រោយ");
    expect(CAST[0].name).toBe("ម៉ាលី");
    expect(numberWord(7)).toBe("ប្រាំពីរ");

    PreferencesAPI.update({ language: "en" });
    expect(STRATEGY_CARDS[0].name).toBe("Count back");
    expect(CAST[0].name).toBe("Mila");
    expect(numberWord(7)).toBe("seven");
  });

  it("reads every lesson's copy and story templates from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      const shown = withLessonEdits("subtraction", lesson);
      expect(shown.title, lesson.id).toMatch(/[ក-៿]/);
      const question = (shown.params as { question?: { templates?: string[] } }).question;
      for (const line of question?.templates ?? []) expect(line, lesson.id).toMatch(/[ក-៿]/);
    }
  });
});
