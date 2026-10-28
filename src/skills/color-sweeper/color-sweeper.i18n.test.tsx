import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { generateLab } from "./internal/reasons";
import { tileLabel } from "./internal/BoardGrid";
import { generateLens } from "./internal/lenses";

/** Colour Sweeper in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("color-sweeper", {
  complete: ["km"],
  source: { dir: "src/skills/color-sweeper", helper: "tw" },
});

const khmer = /[ក-៿]/;

describe("color sweeper in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words clues, reasons and tiles in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    const lab = generateLab({ mode: "choose_reason" }, 17);
    for (const option of lab.options!) expect(option.text).toMatch(khmer);
    const lens = generateLens({ mode: "read_clue" }, 17);
    for (const statement of lens.statements!) expect(statement.text).toMatch(khmer);
    expect(tileLabel(lens.board, lens.target, lens.target)).toMatch(khmer);

    PreferencesAPI.update({ language: "en" });
    expect(tileLabel(lens.board, lens.target, lens.target)).toMatch(/^Row \d, column \d, /);
  });

  it("reads every lesson's copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      expect(withLessonEdits("color-sweeper", lesson).title, lesson.id).toMatch(khmer);
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
