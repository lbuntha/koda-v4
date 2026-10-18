import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { numberWord } from "./internal/data/additionNumbers";
import { STRATEGIES } from "./internal/data/strategyCards";
import { COUNTABLES } from "./internal/data/additionAssets";

/** Addition in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("addition", {
  complete: ["km"],
  source: { dir: "src/skills/addition", helper: "ta" },
});

describe("addition in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("names strategies, objects and numbers in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    expect(STRATEGIES[0].name).toBe("រាប់បន្ត");
    expect(COUNTABLES[0].name).toBe("ផ្លែប៉ោម");
    expect(numberWord(12)).toBe("ដប់ពីរ");

    PreferencesAPI.update({ language: "en" });
    expect(STRATEGIES[0].name).toBe("Count on");
    expect(COUNTABLES[0].name).toBe("apples");
    expect(numberWord(12)).toBe("twelve");
  });

  it("reads every lesson's copy, prompts and stories from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      const shown = withLessonEdits("addition", lesson);
      expect(shown.title, lesson.id).toMatch(/[ក-៿]/);
      const question = (shown.params as { question?: { stories?: string[] } }).question;
      for (const story of question?.stories ?? []) expect(story, lesson.id).toMatch(/[ក-៿]/);
    }
  });
});
