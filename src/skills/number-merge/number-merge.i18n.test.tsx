import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { PreferencesAPI } from "../../lib/preferences";
import { buildMergeQuestion, mergeHints, refusalMessage, setupOf, boardFor } from "./activities/Merge";

/*
 * The engine's words are translated; lesson copy is content and stays in
 * English, so Khmer is checked for the engine only rather than `complete`.
 */
describeSkillLocales("number-merge", { source: { dir: "src/skills/number-merge", helper: "tx" } });

const khmer = /[ក-៿]/;

describe("Number Merge in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words prompts, hints and refusals in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    const params = { question: { mode: "bond" as const, target: 10, size: 4 } };
    expect(buildMergeQuestion(params, 1, "km").prompt).toMatch(khmer);
    const s = setupOf(params);
    for (const rung of mergeHints(s, boardFor(s, "km")).rungs) expect(rung).toMatch(khmer);
    expect(refusalMessage(s, "notBond", 7, 4, 11)).toMatch(khmer);
    PreferencesAPI.update({ language: "en" });
    expect(buildMergeQuestion(params, 1, "km").prompt).toBe("Merge two numbers that make 10.");
  });
});
