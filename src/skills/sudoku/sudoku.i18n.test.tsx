import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales } from "../kit/testing";
import { PreferencesAPI } from "../../lib/preferences";
import { buildGameQuestion, gameHint } from "./activities/Sudoku";
import { buildSpotQuestion } from "./activities/Spot";

/*
 * The engine's words are translated; lesson copy is content and stays in
 * English, so Khmer is checked for the engine only rather than `complete`.
 */
describeSkillLocales("sudoku", { source: { dir: "src/skills/sudoku", helper: "tx" } });

const khmer = /[ក-៿]/;

describe("sudoku in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("words prompts and hints in the language on screen", () => {
    PreferencesAPI.update({ language: "km" });
    const q = buildGameQuestion({ question: { size: 4, technique: "full-house", blanks: 4 } }, 1, "km");
    expect(q.prompt).toMatch(khmer);
    for (const rung of gameHint(q, q.puzzle.givens, "full-house")!.rungs) expect(rung).toMatch(khmer);
    expect(buildSpotQuestion({ question: { size: 9, technique: "hidden-single-box" } }, 1, "km").prompt).toMatch(khmer);
    PreferencesAPI.update({ language: "en" });
    expect(buildGameQuestion({ question: { size: 4, technique: "full-house", blanks: 4 } }, 1, "km").prompt).toMatch(/^Fill the grid/);
  });
});
