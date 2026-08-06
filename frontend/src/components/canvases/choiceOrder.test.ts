import assert from "node:assert/strict";
import test from "node:test";
import { balancedChoiceOrder } from "./choiceOrder";

test("puts the answer in the authored slot without losing choices", () => {
  assert.deepEqual(balancedChoiceOrder([3, 4, 5, 6], 4, 3), [3, 5, 6, 4]);
});

test("wraps a four-slot curriculum hint onto shorter choice sets", () => {
  assert.deepEqual(balancedChoiceOrder(["True", "False"], "True", 3), ["False", "True"]);
});

test("removes duplicate distractors and leaves an absent answer unchanged", () => {
  assert.deepEqual(balancedChoiceOrder([1, 1, 2], 9, 2), [1, 2]);
});
