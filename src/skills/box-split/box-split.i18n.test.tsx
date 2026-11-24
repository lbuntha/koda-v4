import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { PreferencesAPI } from "../../lib/preferences";
import { boxHints, buildBoxQuestion, refusalMessage } from "./activities/BoxSplit";
import { judge } from "./internal/rules";

/*
 * The engine's words are translated; lesson copy is content and stays in
 * English, so Khmer is checked for the engine only rather than `complete`.
 */
describeSkillLocales("box-split", { source: { dir: "src/skills/box-split", helper: "tx" } });

const khmer = /[ក-៿]/;

describe("Box Split in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words prompts, hints and refusals in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    const params = { question: { size: 5, maxArea: 5, technique: "single-fit" as const } };
    const q = buildBoxQuestion(params, 1, "km");
    expect(q.prompt).toMatch(khmer);
    const p = q.puzzle;
    for (const rung of boxHints(p, p.clues.map(() => null), "single-fit")!.rungs) expect(rung).toMatch(khmer);
    const v = judge(p, { r: 0, c: 0, h: 5, w: 5 }, p.clues.map(() => null));
    expect(v.kind).toBe("refuse");
    if (v.kind === "refuse") expect(refusalMessage(p, v)).toMatch(khmer);
    PreferencesAPI.update({ language: "en" });
    expect(buildBoxQuestion(params, 1, "km").prompt).toBe("Split the grid into boxes. Each box has one number, and that many squares.");
  });
});
