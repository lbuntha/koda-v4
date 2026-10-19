import { describe, expect, it } from "vitest";
import { answerRange, mathAnswer, mathExplanation, mathProblem, mathPrompt, resultOf, type MathSpec } from "./math";
import { MATH } from "./content/math";
import { hintFor } from "./hints";
import { answerKey, validatePuzzle } from "./puzzle";
import { matchAnswer } from "./answer";
import type { Puzzle } from "./types";

/** The same cases, in the same order, are in `server/tests/test_rebus_math.py`. */
export const SOUND: ReadonlyArray<readonly [MathSpec, string, number]> = [
  [{ a: 7, op: "×", b: 8, unknown: "result" }, "7 × 8 = ?", 56],
  [{ a: 7, op: "×", b: 8, unknown: "b" }, "7 × ? = 56", 8],
  [{ a: 7, op: "×", b: 8, unknown: "a" }, "? × 8 = 56", 7],
  [{ a: 12, op: "−", b: 5, unknown: "a" }, "? − 5 = 7", 12],
  [{ a: 18, op: "÷", b: 3, unknown: "result" }, "18 ÷ 3 = ?", 6],
  [{ a: 9, op: "+", b: 6, unknown: "b" }, "9 + ? = 15", 6],
];
export const UNSOUND: ReadonlyArray<readonly [MathSpec, string]> = [
  [{ a: 5, op: "−", b: 7, unknown: "result" }, "bad-math-result"],
  [{ a: 7, op: "÷", b: 2, unknown: "result" }, "bad-math-result"],
  [{ a: 7, op: "÷", b: 0, unknown: "result" }, "bad-math-result"],
  [{ a: 9000, op: "+", b: 2000, unknown: "result" }, "bad-math-result"],
  [{ a: 2.5, op: "+", b: 1, unknown: "result" }, "bad-math-numbers"],
  [{ a: -1, op: "+", b: 1, unknown: "result" }, "bad-math-numbers"],
  [{ a: 10000, op: "+", b: 1, unknown: "result" }, "bad-math-numbers"],
  [{ a: 5, op: "x" as never, b: 1, unknown: "result" }, "bad-math-op"],
  [{ a: 5, op: "+", b: 1, unknown: "c" as never }, "bad-math-op"],
  [{ a: 5, op: "×", b: 0, unknown: "a" }, "bad-math-missing"],
  [{ a: 0, op: "÷", b: 5, unknown: "b" }, "bad-math-missing"],
];

describe("math questions", () => {
  it.each(SOUND)("%j reads %s and the answer is %i", (spec, prompt, answer) => {
    expect(mathProblem(spec)).toBeNull();
    expect(mathPrompt(spec)).toBe(prompt);
    expect(mathAnswer(spec)).toBe(answer);
  });

  it.each(UNSOUND)("%j is refused as %s", (spec, code) => {
    expect(mathProblem(spec)).toBe(code);
  });

  it("works out the result and says it in a sentence, and never goes negative or fractional", () => {
    expect(resultOf(6, "×", 7)).toBe(42);
    expect(resultOf(3, "−", 5)).toBeNull();
    expect(resultOf(10, "÷", 4)).toBeNull();
    expect(mathExplanation({ a: 6, op: "×", b: 7, unknown: "b" })).toBe("6 × 7 = 42.");
  });

  it("gives a ten-wide range for the last hint", () => {
    expect(answerRange(56)).toEqual([50, 60]);
    expect(answerRange(7)).toEqual([0, 10]);
    expect(answerRange(100)).toEqual([100, 110]);
  });
});

const first = (n: number): Puzzle => MATH[n];

describe("math puzzles as puzzles", () => {
  it("every one that ships is sound, in step with its numbers, and passes the Studio's checks", () => {
    expect(MATH.length).toBeGreaterThanOrEqual(90);
    expect(MATH.flatMap((p) => validatePuzzle(p).map((i) => `${p.id}: ${i.message}`))).toEqual([]);
  });

  it("is found twice by its numbers, not its answer, so many sums can come to 13", () => {
    const keys = MATH.map(answerKey);
    expect(new Set(keys).size).toBe(MATH.length);
    expect(new Set(MATH.map((p) => p.answer)).size).toBeLessThan(MATH.length);
  });

  it("takes the number typed, with or without a thousands comma, and nothing else", () => {
    const big = MATH.find((p) => p.answer === "1000" || Number(p.answer) >= 1000) ?? first(0);
    expect(matchAnswer(first(0), "7").ok).toBe(true);
    expect(matchAnswer(first(0), " 7 ").ok).toBe(true);
    expect(matchAnswer(first(0), "8").ok).toBe(false);
    expect(matchAnswer(first(0), "70").ok).toBe(false);
    expect(matchAnswer(big, String(Number(big.answer).toLocaleString("en-US"))).ok).toBe(true);
  });

  it("refuses a prompt or answer that has drifted from the numbers, and a missing spec", () => {
    const codes = (p: Puzzle) => validatePuzzle(p).map((i) => i.code);
    expect(codes({ ...first(0), answer: "9" })).toContain("math-out-of-step");
    expect(codes({ ...first(0), pieces: [{ kind: "word", text: "3 + 5 = ?" }] })).toContain("math-out-of-step");
    expect(codes({ ...first(0), math: undefined })).toContain("math-missing");
    expect(codes({ ...first(0), math: { a: 3, op: "÷", b: 2, unknown: "result" } })).toContain("bad-math-result");
  });

  it("narrows a number down instead of spelling it: how many digits, then which ten", () => {
    const sevenEight = MATH.find((p) => p.id === "math-7-times-8-result") ?? first(0);
    expect(hintFor(sevenEight, 1).kind).toBe("category");
    expect(hintFor(sevenEight, 2)).toMatchObject({ kind: "digits", text: "The answer has 2 digits" });
    expect(hintFor(sevenEight, 3)).toMatchObject({ kind: "range", text: "The answer is between 50 and 60" });
  });
});
