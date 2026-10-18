import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { REFUSALS } from "./internal/data/divisionTray";
import { ROUTES } from "./activities/StrategyPicker";
import { buildStoryQuestion } from "./internal/data/divisionStory";

/** Division in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("division", {
  complete: ["km"],
  source: { dir: "src/skills/division", helper: "td" },
});

describe("division in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("reads refusals, routes and stories in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    expect(REFUSALS["not-equal"]).toBe("ចាននីមួយៗត្រូវមានចំនួនដូចគ្នា។");
    expect(ROUTES[0].label).toMatch(/[ក-៿]/);
    expect(buildStoryQuestion({}, "size_unknown", 0).story).toMatch(/[ក-៿]/);

    PreferencesAPI.update({ language: "en" });
    expect(REFUSALS["not-equal"]).toBe("Every plate needs the same number.");
    expect(ROUTES[0].label).toBe("Halve it, maybe more than once");
  });

  it("reads every lesson's copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      const shown = withLessonEdits("division", lesson);
      expect(shown.title, lesson.id).toMatch(/[ក-៿]/);
    }
  });

  it("draws a round in Khmer when Khmer is chosen", () => {
    PreferencesAPI.update({ language: "km" });
    for (const id of Object.keys(skill.activities)) {
      const h = renderActivity(skill.activities[id as keyof typeof skill.activities]);
      expect(document.body.textContent ?? "", id).toMatch(/[ក-៿]/);
      h.unmount();
    }
  });
});
