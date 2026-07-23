import assert from "node:assert/strict";
import test from "node:test";
import {
  ADDEND_MAX,
  buildColumnAdditionModel,
  clampAddend,
  columnNarration,
  diagnoseColumnError,
  generateChallenges,
} from "./columnAdditionModel";

test("Column Addition accepts addends through five digits", () => {
  assert.equal(ADDEND_MAX, 99_999);
  assert.equal(clampAddend(99_999), 99_999);
  assert.equal(clampAddend(100_000), 99_999);
});

test("Column Addition resolves a full five-digit cascading carry", () => {
  const model = buildColumnAdditionModel(99_999, 99_999);

  assert.equal(model.sum, 199_998);
  assert.equal(model.answerDigits.slice().reverse().join(""), "199998");
  assert.equal(model.columns.length, 6);
  assert.equal(model.carryCount, 5);
  assert.deepEqual(model.columns.map(column => column.placeLabel), [
    "ones", "tens", "hundreds", "thousands", "ten-thousands", "hundred-thousands",
  ]);
});

test("Column Addition aligns unequal addend lengths by place value", () => {
  const model = buildColumnAdditionModel(12_345, 678);

  assert.equal(model.sum, 13_023);
  assert.equal(model.digitMode, "5+3");
  assert.equal(model.answerDigits.slice().reverse().join(""), "13023");
  assert.equal(model.columns[3].hasDigit2, false);
});

test("Column Addition narration names the written and receiving places", () => {
  const ones = buildColumnAdditionModel(8, 7).columns[0];
  const narration = columnNarration(ones);

  assert.match(narration.write, /ones/);
  assert.match(narration.write, /1 ten/);
  assert.match(narration.write, /tens/);
});

test("Column Addition diagnoses missed and extra carries", () => {
  const carriedTens = buildColumnAdditionModel(58, 67).columns[1];
  assert.equal(carriedTens.carryIn, 1);
  assert.equal(diagnoseColumnError(carriedTens, 1), "missed_carry");

  const plainOnes = buildColumnAdditionModel(23, 14).columns[0];
  assert.equal(plainOnes.carryIn, 0);
  assert.equal(diagnoseColumnError(plainOnes, 8), "extra_carry");
  assert.equal(diagnoseColumnError(plainOnes, 9), "incorrect_column_sum");
});

test("Column Addition challenge generation preserves five-digit shape and carrying mode", () => {
  const source = buildColumnAdditionModel(54_321, 12_345);
  const challenges = generateChallenges(source.num1, source.num2, 3);

  assert.equal(challenges.length, 3);
  for (const challenge of challenges) {
    const model = buildColumnAdditionModel(challenge.num1, challenge.num2);
    assert.equal(model.digitMode, source.digitMode);
    assert.equal(model.anyCarry, source.anyCarry);
  }
});

test("Multi-Row Column Addition carries values greater than one", () => {
  const model = buildColumnAdditionModel(999, 999, 999);

  assert.equal(model.addendCount, 3);
  assert.equal(model.sum, 2_997);
  assert.equal(model.answerDigits.slice().reverse().join(""), "2997");
  assert.deepEqual(model.columns.map(column => column.carryOut), [2, 2, 2, 0]);
  assert.equal(model.digitMode, "3+3+3");
});

test("Multi-Row Column Addition narration includes all three addends and the full carry", () => {
  const ones = buildColumnAdditionModel(9, 8, 7).columns[0];
  const narration = columnNarration(ones);

  assert.match(narration.add, /\*\*9\*\* plus \*\*8\*\* plus \*\*7\*\*/);
  assert.match(narration.write, /Carry \*\*2 tens\*\*/);
});
