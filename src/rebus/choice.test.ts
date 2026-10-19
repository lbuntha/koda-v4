import { describe, expect, it } from "vitest";
import { matchAnswer } from "./answer";
import { choiceAnswer, choiceProblem, deriveChoice, visibleOptions, type ChoiceSpec } from "./choice";
import { hintFor } from "./hints";
import { answerKey, validatePuzzle } from "./puzzle";
import type { Puzzle } from "./types";

/** The same cases, in the same order, are in `server/tests/test_rebus_choice.py`. */
const SOUND: ChoiceSpec[] = [
  { options: ["Paris", "Rome"], correct: 0 },
  { options: ["Paris", "Rome", "Madrid"], correct: 2 },
  { options: ["ភ្នំពេញ", "សៀមរាប", "កំពត", "បាត់ដំបង"], correct: 1 },
];
const UNSOUND: ReadonlyArray<readonly [unknown, string]> = [
  [{ options: ["Paris"], correct: 0 }, "choice-options"],
  [{ options: ["a", "b", "c", "d", "e"], correct: 0 }, "choice-options"],
  [{ options: ["Paris", " "], correct: 0 }, "choice-blank"],
  [{ options: ["Paris", "x".repeat(41)], correct: 0 }, "choice-blank"],
  [{ options: ["Paris", "paris!"], correct: 0 }, "choice-duplicate"],
  [{ options: ["Paris", "Rome"], correct: 2 }, "choice-correct"],
  [{ options: ["Paris", "Rome"], correct: -1 }, "choice-correct"],
  [null, "choice-missing"],
  [{ correct: 0 }, "choice-missing"],
];

const question = (spec: ChoiceSpec, over: Partial<Puzzle> = {}): Puzzle => ({
  id: "q",
  category: "countries",
  ages: [7, 12],
  difficulty: 1,
  trick: "compound",
  kind: "choice",
  choice: spec,
  pieces: [{ kind: "word", text: "What is the capital of France?" }],
  answer: choiceAnswer(spec),
  accepts: [],
  explanation: "Paris is the capital of France.",
  source: "official",
  ...over,
});

describe("multiple-choice answers", () => {
  it.each(SOUND)("%j is sound", (spec) => {
    expect(choiceProblem(spec)).toBeNull();
    expect(choiceAnswer(spec)).toBe(spec.options[spec.correct]);
  });
  it.each(UNSOUND)("%j is refused as %s", (spec, code) => {
    expect(choiceProblem(spec)).toBe(code);
  });
  it("trims what was typed, and works out the answer from the right one", () => {
    expect(deriveChoice({ options: [" Paris ", "Rome"], correct: 0 })).toEqual({ choice: { options: ["Paris", "Rome"], correct: 0 }, answer: "Paris", accepts: [] });
    expect(deriveChoice({ options: ["Paris", "paris"], correct: 0 })).toBeNull();
  });
});

describe("a multiple-choice puzzle", () => {
  const codes = (p: Puzzle) => validatePuzzle(p).map((i) => i.code);

  it("passes when it is sound and its answer follows the marked option", () => {
    expect(codes(question(SOUND[1]))).toEqual([]);
    // A short answer is fine for a tap ("A", "7"), unlike a typed one.
    expect(codes(question({ options: ["A", "B"], correct: 1 }))).toEqual([]);
  });

  it("is refused when the answer has drifted, the answers are wrong, or there is no question", () => {
    expect(codes(question(SOUND[0], { answer: "Rome" }))).toContain("choice-out-of-step");
    expect(codes(question({ options: ["Paris", "paris"], correct: 0 }))).toContain("choice-duplicate");
    expect(codes(question(SOUND[0], { pieces: [] }))).toContain("no-picture");
    expect(codes(question(SOUND[0], { choice: undefined }))).toContain("choice-missing");
  });

  it("is told apart by its question, not only its answer", () => {
    const eiffel = question(SOUND[0], { pieces: [{ kind: "word", text: "Where is the Eiffel Tower?" }] });
    expect(answerKey(question(SOUND[0]))).not.toBe(answerKey(eiffel));
    expect(answerKey(question(SOUND[0]))).toBe(answerKey(question(SOUND[0], { id: "other" })));
  });

  it("is matched exactly: one slipped key makes a different option, never a typo", () => {
    const long = question({ options: ["Mississippi", "Mississipi"], correct: 0 });
    expect(matchAnswer(long, "Mississippi").ok).toBe(true);
    expect(matchAnswer(long, "Mississipi").ok).toBe(false);
    expect(matchAnswer({ answer: "Mississippi", accepts: [] }, "Mississipi").ok).toBe(true);
  });

  it("takes a wrong answer away with each hint after the first, but always leaves two", () => {
    const four: ChoiceSpec = { options: ["Paris", "Rome", "Madrid", "Berlin"], correct: 0 };
    const sizes = [0, 1, 2, 3].map((hints) => visibleOptions(four, hints, "seed").length);
    expect(sizes).toEqual([4, 4, 3, 2]);
    const left = visibleOptions(four, 3, "seed");
    expect(left).toContain("Paris");
    // Two answers can lose none.
    expect(visibleOptions(SOUND[0], 3, "seed")).toHaveLength(2);
    // The same seed shows the same order, a different one does not always put the right answer first.
    expect(visibleOptions(four, 0, "seed")).toEqual(visibleOptions(four, 0, "seed"));
    const firsts = new Set(Array.from({ length: 12 }, (_, i) => visibleOptions(four, 0, `q${i}`)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("hints take answers away instead of spelling them, and say so when there is nothing left to take", () => {
    const three = question(SOUND[1]);
    expect(hintFor(three, 1).kind).toBe("category");
    expect(hintFor(three, 2)).toMatchObject({ kind: "eliminate", text: "One wrong answer is taken away" });
    expect(hintFor(three, 3).text).toBe("Only two answers are left. Look at the question again");
  });
});
