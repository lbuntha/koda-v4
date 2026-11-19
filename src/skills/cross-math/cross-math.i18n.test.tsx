import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { PreferencesAPI } from "../../lib/preferences";
import { buildQuestion, crossHints, promptFor } from "./activities/CrossMath";

/*
 * The engine's words are translated; lesson copy is content and stays in
 * English, so Khmer is checked for the engine only rather than `complete`.
 */
describeSkillLocales("cross-math", { source: { dir: "src/skills/cross-math", helper: "tx" } });

const khmer = /[ក-៿]/;

describe("cross math in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words the prompt and hints in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    const q = buildQuestion({ question: { ops: ["+"], max: 10, blanks: 2 } }, 1, "km");
    expect(promptFor(q)).toMatch(khmer);
    for (const rung of crossHints(q, q.puzzle.slots.map(() => null))) expect(rung).toMatch(khmer);
    PreferencesAPI.update({ language: "en" });
    expect(promptFor(q)).toMatch(/^Put the tiles/);
  });
});
