import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { refuseReason } from "./internal/pour";
import { goalFor, refusalFor } from "./internal/goal";
import { specFor } from "./internal/specs";
import { colourName } from "./internal/paint";

/** Bottle Sort in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("bottle-sort", {
  complete: ["km"],
  source: { dir: "src/skills/bottle-sort", helper: "tb" },
});

const khmer = /[ក-៿]/;

describe("bottle sort in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("reads refusals, goals and colour names in the language on screen", () => {
    const goal = goalFor(specFor("sort-backwards")!);
    const full = { seg: [0, 0, 0, 0], cap: 4 };
    PreferencesAPI.update({ language: "km" });
    expect(refusalFor(goal, full, 0)).toMatch(khmer);
    expect(refuseReason([{ seg: [], cap: 4 }, full], 0, 1)).toMatch(khmer);
    expect(colourName(0)).toMatch(khmer);

    PreferencesAPI.update({ language: "en" });
    expect(refusalFor(goal, { seg: [3], cap: 4 }, 1)).toBe("That is not what comes next. They go biggest to smallest.");
    expect(colourName(0)).toBe("circle 1");
  });

  it("reads every lesson's copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      expect(withLessonEdits("bottle-sort", lesson).title, lesson.id).toMatch(khmer);
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
