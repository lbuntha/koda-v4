import type { AgeRange } from "../../lib/ages";
import { mathAnswer, mathExplanation, mathPrompt, type MathOp, type MathUnknown } from "../math";
import type { Difficulty, Puzzle } from "../types";

/**
 * Math: the sum is written down as numbers, and everything else is worked out.
 *
 * Three levels. Easy is adding and taking away within 20, and the missing
 * number in a small sum. Medium is two-digit adding and taking away, the times
 * tables up to 10, the matching division, and a missing factor. Hard is three
 * digits, two-digit times tables, longer division, and a missing number in a
 * bigger sum. Every question is a draft for a person to look at, like the rest.
 */

const NAME: Record<MathOp, string> = { "+": "plus", "−": "minus", "×": "times", "÷": "by" };

const make = (a: number, op: MathOp, b: number, unknown: MathUnknown, difficulty: Difficulty, ages: AgeRange): Puzzle => {
  const spec = { a, op, b, unknown };
  return {
    id: `math-${a}-${NAME[op]}-${b}-${unknown}`,
    category: "math",
    ages,
    difficulty,
    trick: "compound",
    kind: "math",
    math: spec,
    pieces: [{ kind: "word", text: mathPrompt(spec) }],
    answer: String(mathAnswer(spec)),
    accepts: [],
    explanation: mathExplanation(spec),
    source: "official",
  };
};

type Row = readonly [number, MathOp, number, MathUnknown?];

const level = (difficulty: Difficulty, ages: AgeRange, rows: readonly Row[]): Puzzle[] =>
  rows.map(([a, op, b, unknown = "result"]) => make(a, op, b, unknown, difficulty, ages));

const EASY = level(1, [5, 9], [
  [3, "+", 4], [5, "+", 2], [6, "+", 3], [7, "+", 5], [8, "+", 4], [9, "+", 6], [4, "+", 4], [7, "+", 7], [8, "+", 6], [9, "+", 9], [5, "+", 5], [6, "+", 7],
  [10, "−", 3], [12, "−", 5], [15, "−", 7], [14, "−", 6], [17, "−", 9], [11, "−", 4], [16, "−", 8], [13, "−", 5],
  [4, "+", 5, "b"], [6, "+", 7, "b"], [8, "+", 3, "b"], [9, "+", 5, "b"], [7, "+", 8, "b"], [5, "+", 9, "b"],
]);

const MEDIUM = level(2, [7, 12], [
  [27, "+", 48], [36, "+", 29], [58, "+", 17], [45, "+", 38], [64, "+", 19], [73, "+", 18], [39, "+", 46], [52, "+", 39],
  [82, "−", 37], [91, "−", 45], [63, "−", 28], [70, "−", 34], [55, "−", 19], [84, "−", 56], [92, "−", 38], [76, "−", 49],
  [3, "×", 4], [6, "×", 7], [8, "×", 5], [9, "×", 6], [7, "×", 8], [4, "×", 9], [6, "×", 6], [8, "×", 8], [9, "×", 9], [7, "×", 7], [10, "×", 7], [3, "×", 9], [8, "×", 6],
  [12, "÷", 3], [18, "÷", 6], [24, "÷", 8], [35, "÷", 7], [48, "÷", 6], [63, "÷", 9], [72, "÷", 8], [56, "÷", 7], [81, "÷", 9], [45, "÷", 5],
  [6, "×", 7, "b"], [8, "×", 9, "b"], [7, "×", 4, "b"], [9, "×", 5, "b"], [4, "×", 8, "b"],
]);

const HARD = level(3, [10, 14], [
  [348, "+", 275], [467, "+", 385], [529, "+", 296], [618, "+", 247], [735, "+", 189], [842, "+", 158],
  [500, "−", 237], [623, "−", 478], [800, "−", 356], [742, "−", 295], [910, "−", 463], [1000, "−", 648],
  [23, "×", 4], [35, "×", 6], [48, "×", 7], [56, "×", 8], [67, "×", 9], [74, "×", 5], [89, "×", 6], [95, "×", 8],
  [12, "×", 12], [15, "×", 14], [24, "×", 13], [35, "×", 12], [45, "×", 11], [36, "×", 15],
  [144, "÷", 12], [169, "÷", 13], [252, "÷", 12], [336, "÷", 14], [405, "÷", 15], [520, "÷", 13], [396, "÷", 18], [288, "÷", 16],
  [125, "+", 175, "b"], [423, "−", 148, "a"], [17, "×", 12, "b"], [91, "÷", 7, "a"],
]);

export const MATH: Puzzle[] = [...EASY, ...MEDIUM, ...HARD];
