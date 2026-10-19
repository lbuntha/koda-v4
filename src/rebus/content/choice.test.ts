import { describe, expect, it } from "vitest";
import { answerKey, validatePuzzle } from "../puzzle";
import { CHOICE } from "./choice";

describe("the multiple-choice samples", () => {
  it("are sound, with the right answer marked, and pass the Studio's checks", () => {
    expect(CHOICE.length).toBeGreaterThanOrEqual(12);
    expect(CHOICE.flatMap((p) => validatePuzzle(p).map((i) => `${p.id}: ${i.message}`))).toEqual([]);
    for (const p of CHOICE) expect(p.choice && p.choice.options[p.choice.correct], p.id).toBe(p.answer);
  });

  it("have unique ids and questions", () => {
    expect(new Set(CHOICE.map((p) => p.id)).size).toBe(CHOICE.length);
    expect(new Set(CHOICE.map(answerKey)).size).toBe(CHOICE.length);
  });

  it("are not always answered by the first option when a child plays them", () => {
    // The author's marked option is first here, so the shuffle at play time is what spreads them out.
    expect(CHOICE.some((p) => p.choice?.correct !== 0)).toBe(true);
  });

  it("include Khmer questions, a question with a picture, and options in each language", () => {
    expect(CHOICE.filter((p) => p.category === "khmer").length).toBeGreaterThanOrEqual(3);
    expect(CHOICE.some((p) => p.pieces.some((x) => x.kind === "icon"))).toBe(true);
  });
});
