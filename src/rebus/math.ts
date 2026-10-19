/**
 * Math questions: the numbers, and everything else worked out from them.
 *
 * An author never types a math answer. They choose two numbers, an operation
 * and which part is missing (`7 × 8 = ?`, or `7 × ? = 56`), and the prompt and
 * the answer are computed here. That is what keeps a math question from ever
 * being wrong, and it means a question can be checked, listed and found twice
 * by its numbers, not by its answer (many sums come to 13).
 *
 * Whole numbers only, never negative, division exact, nothing past 9999: what a
 * child can type on a number pad and be sure of. `server/app/rebus_math.py` is
 * the same rules in Python, tested against the same cases.
 */

export const MATH_OPS = ["+", "−", "×", "÷"] as const;
export type MathOp = (typeof MATH_OPS)[number];
export type MathUnknown = "result" | "a" | "b";

export interface MathSpec {
  a: number;
  op: MathOp;
  b: number;
  /** Which part the child works out. */
  unknown: MathUnknown;
}

export const MATH_MAX = 9999;

const isWhole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MATH_MAX;

/** The result of `a op b`, or null when it is not a whole number in range. */
export const resultOf = (a: number, op: MathOp, b: number): number | null => {
  let value: number;
  switch (op) {
    case "+":
      value = a + b;
      break;
    case "−":
      value = a - b;
      break;
    case "×":
      value = a * b;
      break;
    case "÷":
      if (b === 0 || a % b !== 0) return null;
      value = a / b;
      break;
  }
  return isWhole(value) ? value : null;
};

/** What is wrong with these numbers, as a code, or null when the question is sound. */
export const mathProblem = (spec: MathSpec): "bad-math-numbers" | "bad-math-op" | "bad-math-result" | "bad-math-missing" | null => {
  if (!isWhole(spec.a) || !isWhole(spec.b)) return "bad-math-numbers";
  if (!MATH_OPS.includes(spec.op)) return "bad-math-op";
  if (!["result", "a", "b"].includes(spec.unknown)) return "bad-math-op";
  const result = resultOf(spec.a, spec.op, spec.b);
  if (result === null) return "bad-math-result";
  // Dividing by nothing, or "? ÷ 0", has no one answer; "0 × ? = 0" has every answer.
  if (spec.unknown !== "result" && spec.op === "×" && (spec.unknown === "a" ? spec.b : spec.a) === 0) return "bad-math-missing";
  if (spec.unknown === "b" && spec.op === "÷" && result === 0) return "bad-math-missing";
  return null;
};

/** The number the child has to find. Only meaningful when `mathProblem` is null. */
export const mathAnswer = (spec: MathSpec): number => {
  const result = resultOf(spec.a, spec.op, spec.b) ?? 0;
  return spec.unknown === "result" ? result : spec.unknown === "a" ? spec.a : spec.b;
};

/** The question as it is read: `7 × 8 = ?`, `? + 5 = 12`. */
export const mathPrompt = (spec: MathSpec): string => {
  const result = resultOf(spec.a, spec.op, spec.b) ?? 0;
  const a = spec.unknown === "a" ? "?" : String(spec.a);
  const b = spec.unknown === "b" ? "?" : String(spec.b);
  const r = spec.unknown === "result" ? "?" : String(result);
  return `${a} ${spec.op} ${b} = ${r}`;
};

/** Why these numbers give that answer, in a sentence a child can follow. */
export const mathExplanation = (spec: MathSpec): string => {
  const result = resultOf(spec.a, spec.op, spec.b) ?? 0;
  return `${spec.a} ${spec.op} ${spec.b} = ${result}.`;
};

export const isMathSpec = (value: unknown): value is MathSpec => {
  if (typeof value !== "object" || value === null) return false;
  const x = value as Record<string, unknown>;
  return typeof x.a === "number" && typeof x.b === "number" && typeof x.op === "string" && typeof x.unknown === "string";
};

/** The two ends of a ten-wide range around the answer, for the last hint: 56 is "between 50 and 60". */
export const answerRange = (answer: number): [number, number] => {
  const low = Math.floor(answer / 10) * 10;
  return [low, low + 10];
};

/** What a math question's stored fields are, worked out from its numbers: the prompt, the answer and the explanation. */
export const deriveMath = (spec: MathSpec): { pieces: [{ kind: "word"; text: string }]; answer: string; accepts: string[]; explanation: string } | null =>
  mathProblem(spec) === null ? { pieces: [{ kind: "word", text: mathPrompt(spec) }], answer: String(mathAnswer(spec)), accepts: [], explanation: mathExplanation(spec) } : null;
