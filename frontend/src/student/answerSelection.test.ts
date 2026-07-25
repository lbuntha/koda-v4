import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique, type CountingQuestion } from "../types";
import { solvedSelection } from "./answerSelection";

const question = (
  technique: CountingTechnique,
  config: Record<string, any>,
  targetCount?: number,
): CountingQuestion => ({
  id: `question-${technique}`,
  technique,
  title: "Curriculum question",
  instruction: "Solve it",
  objectId: "apple",
  targetCount,
  config,
});

test("resolved selections come from each curriculum question's authored values", () => {
  assert.equal(
    solvedSelection(question(CountingTechnique.ONE_TO_ONE, {}, 9)),
    "9",
  );
  assert.equal(
    solvedSelection(question(CountingTechnique.ADDITION_COLUMN, { num1: 8, num2: 7 })),
    "15",
  );
  assert.equal(
    solvedSelection(question(CountingTechnique.SUBTRACTION_COLUMN, { minuend: 13, subtrahend: 5 })),
    "8",
  );
});

test("private answer-key activities must report the child's actual selection", () => {
  assert.equal(
    solvedSelection(question(CountingTechnique.KODA_PATTERN, { patternSequence: ["A", "B", ""] })),
    null,
  );
});
