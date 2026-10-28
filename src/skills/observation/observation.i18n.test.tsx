import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { CATEGORY_LABELS, OBJECT_CATALOG } from "./internal/data";
import { SCENES } from "./internal/scenes";
import { objectName, placeName, sceneName } from "./internal/i18n";
import { buildQuestion } from "./activities/ObjectHunt";

/** Observation in Khmer: every line translated, and choosing Khmer reaches the round. */

describeSkillLocales("observation", {
  complete: ["km"],
  source: { dir: "src/skills/observation", helper: "to" },
});

const khmer = /[ក-៿]/;

describe("observation in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("names every object, scene and place", () => {
    PreferencesAPI.update({ language: "km" });
    for (const object of OBJECT_CATALOG) expect(objectName(object.id), object.id).toMatch(khmer);
    for (const scene of SCENES) {
      expect(sceneName(scene.id), scene.id).toMatch(khmer);
      expect(placeName(scene.place), scene.place).toMatch(khmer);
    }
    for (const label of Object.values(CATEGORY_LABELS)) expect(label).toMatch(khmer);
  });

  it("reads the lesson copy and the question from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) expect(withLessonEdits("observation", lesson).title, lesson.id).toMatch(khmer);
    expect(buildQuestion({ seed: "km", targetCount: 1 }, 1).prompt).toMatch(khmer);

    PreferencesAPI.update({ language: "en" });
    expect(buildQuestion({ seed: "km", targetCount: 1 }, 1).prompt).toMatch(/^Find the /);
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
