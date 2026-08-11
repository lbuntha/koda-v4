import type { CountingQuestion } from "../types";
import { boardTotalsForTechnique } from "../components/canvases/countStaging/boardTotals";

const COUNTING = new Set([
  "ONE_TO_ONE", "MOVE_AND_COUNT", "LINE_UP_AND_COUNT", "GROUP_IN_TENS",
  "COUNT_ON", "COUNT_BACK", "DIFFERENT_ARRANGEMENTS", "COUNT_MAGNETS", "SUBITIZE",
]);

/**
 * Resolve the observable value produced by a solved derived-answer activity.
 * Private answer-key activities report their actual selection from the canvas
 * instead, so this helper intentionally returns null for those techniques.
 */
export const solvedSelection = (question: CountingQuestion): string | null => {
  const config = question.config ?? {};
  if (COUNTING.has(question.technique)) {
    /*
      The board's own answer, not the slide's `targetCount`.

      These used to be guessed here from the shape of `config`, with
      `targetCount` checked first — so a Count Back board whose answer was "eight
      left of twelve" reported twelve, and the child was right while the record
      was wrong. `boardTotals` is the same derivation the canvas checks against,
      so the two cannot disagree.
    */
    const { expected } = boardTotalsForTechnique(question.technique, config, question.targetCount);
    if (Number.isFinite(expected)) return String(expected);
  }

  switch (question.technique) {
    case "ADDITION_SANDBOX":
      return String((config.addend1 ?? 0) + (config.addend2 ?? 0));
    case "ADDITION_TUTOR":
    case "ADDITION_COLUMN":
      return String((config.num1 ?? 0) + (config.num2 ?? 0));
    case "ADDITION_COLUMN_MULTI":
      return String((config.num1 ?? 0) + (config.num2 ?? 0) + (config.num3 ?? 0));
    case "SUBTRACTION_SANDBOX":
    case "SUBTRACTION_COLUMN":
      return String((config.minuend ?? 0) - (config.subtrahend ?? 0));
    case "SUBTRACTION_COLUMN_MULTI":
      return String((config.minuend ?? 0) - (config.subtrahend ?? 0) - (config.subtrahend2 ?? 0));
    case "MULTIPLICATION_COLUMN":
      return String((config.multiplicand ?? 0) * (config.multiplier ?? 0));
    case "MULTIPLICATION_ARRAY":
      return String((config.rows ?? 0) * (config.cols ?? 0));
    default:
      return null;
  }
};
