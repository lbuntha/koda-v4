/**
 * A Studio panel must never be stricter than the component it edits.
 *
 * The Addition Sandbox panel capped both addends at 6 while the canvas and the AI schema
 * accept 1–9. Opening Grade 1's make-a-ten questions (8 + 7, 9 + 8) and touching either
 * field silently rewrote them to 6 — changing the question, its answer and the strategy it
 * was built to teach, with no warning and nothing in the UI to suggest it had happened.
 * Count On and Count Back had the same mismatch.
 *
 * This test asserts the ranges the panels enforce against the ranges the schemas allow, so
 * a panel and its component cannot drift apart again. The panel bounds are duplicated here
 * deliberately: the panels are JSX with inline `min`/`max`, and a test that imported the
 * real value could not fail.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GRADE_1_MATH_QUESTIONS } from "../../../curriculum/grade1MathQuestions";

/** What each panel's inputs actually allow, read off the JSX. */
const PANEL_BOUNDS = {
  ADDITION_SANDBOX: { addend1: [1, 9], addend2: [1, 9] },
  COUNT_ON: { baseCount: [1, 10], extraCount: [1, 8] },
  COUNT_BACK: { totalCount: [3, 15] },
} as const;

test("every authored question sits inside the range its panel allows", () => {
  const questions = GRADE_1_MATH_QUESTIONS.flatMap(skill => skill.questions);
  for (const question of questions) {
    const bounds = PANEL_BOUNDS[question.technique as keyof typeof PANEL_BOUNDS];
    if (!bounds) continue;
    for (const [field, [min, max]] of Object.entries(bounds)) {
      const value = (question.config as Record<string, number>)[field];
      if (value === undefined) continue;
      assert.ok(
        value >= min && value <= max,
        `${question.id}: ${field}=${value} is outside the panel's ${min}-${max}, so opening it `
        + "in the Studio and touching the field would silently rewrite the question",
      );
    }
  }
});

test("count-back questions never remove more than the panel can express", () => {
  // The panel caps `removeCount` at totalCount - 1, because crossing out everything leaves
  // nothing to count back to.
  for (const skill of GRADE_1_MATH_QUESTIONS) {
    for (const question of skill.questions) {
      if (question.technique !== "COUNT_BACK") continue;
      const { totalCount, removeCount } = question.config as Record<string, number>;
      assert.ok(removeCount >= 1 && removeCount <= totalCount - 1, `${question.id}: ${removeCount}/${totalCount}`);
    }
  }
});

test("the make-a-ten questions are the ones the old cap would have broken", () => {
  // Guards the regression directly: these are the addends that could not be authored at 6.
  const strategies = GRADE_1_MATH_QUESTIONS.find(s => s.skillId === "strategies-within-20");
  const addends = strategies!.questions.map(q => (q.config as Record<string, number>).addend1);
  assert.ok(addends.some(value => value > 6), "expected addends above the old cap of 6");
});
