import assert from "node:assert/strict";
import test from "node:test";
import {
  buildColumnMultiplicationModel,
  diagnoseMultiplicationError,
  multiplicationStepNarration,
} from "./columnMultiplicationModel";

test("Column Multiplication builds shifted partial products", () => {
  const model = buildColumnMultiplicationModel(234, 56);

  assert.equal(model.product, 13_104);
  assert.deepEqual(model.partialRows.map(row => row.value), [1_404, 11_700]);
  assert.deepEqual(model.partialRows[1].answerDigits, [0, 0, 7, 1, 1]);
  assert.equal(model.stages.at(-1)?.kind, "final");
});

test("Column Multiplication exposes two partial rows plus the result for 231 × 23", () => {
  const model = buildColumnMultiplicationModel(231, 23);

  assert.deepEqual(model.partialRows.map(row => row.value), [693, 4_620]);
  assert.deepEqual(model.stages.map(stage => stage.value), [693, 4_620, 5_313]);
  assert.deepEqual(model.stages.map(stage => stage.kind), ["partial", "partial", "final"]);
});

test("Column Multiplication supports five by three digits", () => {
  const model = buildColumnMultiplicationModel(99_999, 999);

  assert.equal(model.product, 99_899_001);
  assert.equal(model.partialRows.length, 3);
  assert.equal(model.productDigits.length, 8);
});

test("Column Multiplication skips a duplicate final stage for one multiplier digit", () => {
  const model = buildColumnMultiplicationModel(321, 4);

  assert.equal(model.stages.length, 1);
  assert.equal(model.stages[0].value, 1_284);
});

test("Column Multiplication carries through each digit", () => {
  const row = buildColumnMultiplicationModel(999, 9).partialRows[0];

  assert.deepEqual(row.steps.map(step => step.carryOut), [8, 8, 8, 0]);
  assert.equal(row.value, 8_991);
});

test("Column Multiplication narration and diagnosis include incoming carry", () => {
  const step = buildColumnMultiplicationModel(29, 4).partialRows[0].steps[1];
  const narration = multiplicationStepNarration(step);

  assert.match(narration.multiply, /carried \*\*3\*\*/);
  assert.equal(diagnoseMultiplicationError(step, 8), "missed_carry");
});
