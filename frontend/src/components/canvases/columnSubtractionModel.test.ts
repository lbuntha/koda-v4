import assert from "node:assert/strict";
import test from "node:test";
import {
  buildColumnSubtractionModel,
  diagnoseSubtractionColumnError,
  generateSubtractionChallenges,
  normalizeMultiRowSubtractionOperands,
  normalizeSubtractionOperands,
  subtractionColumnNarration,
} from "./columnSubtractionModel";

test("Column Subtraction clamps operands and prevents a negative result", () => {
    assert.deepEqual(normalizeSubtractionOperands(120_000, 130_000), {
      minuend: 99_999,
      subtrahend: 99_999,
    });
    assert.deepEqual(normalizeSubtractionOperands(-4, 8), { minuend: 0, subtrahend: 0 });
  });

test("Column Subtraction subtracts five-digit values by place", () => {
    const model = buildColumnSubtractionModel(99_999, 12_345);
    assert.equal(model.difference, 87_654);
    assert.deepEqual(model.answerDigits, [4, 5, 6, 7, 8]);
    assert.equal(model.anyBorrow, false);
  });

test("Column Subtraction cascades borrowing through zeroes without requiring a leading zero", () => {
    const model = buildColumnSubtractionModel(10_000, 1);
    assert.equal(model.difference, 9_999);
    assert.deepEqual(model.columns.map(column => column.digitOut), [9, 9, 9, 9, 0]);
    assert.deepEqual(model.columns.map(column => column.borrowOut), [1, 1, 1, 1, 0]);
    assert.deepEqual(model.answerDigits, [9, 9, 9, 9]);
    assert.equal(model.columns[4].requiresAnswer, false);
  });

test("Column Subtraction supports different operand lengths", () => {
    const model = buildColumnSubtractionModel(4_321, 78);
    assert.equal(model.difference, 4_243);
    assert.equal(model.digitMode, "4-2");
  });

test("Column Subtraction narrates the borrow and resulting digit", () => {
    const column = buildColumnSubtractionModel(42, 18).columns[0];
    const narration = subtractionColumnNarration(column);
    assert.match(narration.subtract, /borrow \*\*1 ten\*\*/);
    assert.match(narration.write, /\*\*12\*\* minus \*\*8\*\* is \*\*4\*\*/);
  });

test("Column Subtraction diagnoses a missed incoming borrow", () => {
    const tens = buildColumnSubtractionModel(42, 18).columns[1];
    assert.equal(diagnoseSubtractionColumnError(tens, 3), "missed_borrow");
  });

test("Column Subtraction builds practice with matching shape and borrow pattern", () => {
    const source = buildColumnSubtractionModel(432, 178);
    const challenges = generateSubtractionChallenges(432, 178, 2);
    assert.equal(challenges.length, 2);
    for (const challenge of challenges) {
      const candidate = buildColumnSubtractionModel(challenge.minuend, challenge.subtrahend);
      assert.equal(candidate.digitMode, source.digitMode);
      assert.deepEqual(
        candidate.columns.map(column => column.borrowOut),
        source.columns.map(column => column.borrowOut),
      );
    }
  });

test("Multi-Row Column Subtraction keeps the combined subtraction non-negative", () => {
  assert.deepEqual(normalizeMultiRowSubtractionOperands(100, 80, 50), {
    minuend: 100,
    subtrahend: 80,
    subtrahend2: 20,
  });
});

test("Multi-Row Column Subtraction subtracts two lower rows by place", () => {
  const model = buildColumnSubtractionModel(432, 178, 56);

  assert.equal(model.rowCount, 3);
  assert.equal(model.difference, 198);
  assert.deepEqual(model.answerDigits, [8, 9, 1]);
  assert.equal(model.digitMode, "3-3-2");
});

test("Multi-Row Column Subtraction can borrow two units into a column", () => {
  const model = buildColumnSubtractionModel(30, 9, 8);

  assert.equal(model.difference, 13);
  assert.equal(model.columns[0].borrowOut, 2);
  assert.equal(model.columns[0].workingTop, 20);
  assert.equal(model.columns[0].digitOut, 3);
  assert.equal(model.columns[1].borrowIn, 2);
});

test("Multi-Row Column Subtraction narration names both lower digits and borrow amount", () => {
  const ones = buildColumnSubtractionModel(30, 9, 8).columns[0];
  const narration = subtractionColumnNarration(ones);

  assert.match(narration.subtract, /\*\*9\*\* plus \*\*8\*\*/);
  assert.match(narration.subtract, /borrow \*\*2 tens\*\*/);
  assert.match(narration.write, /\*\*20\*\* minus \*\*9\*\* minus \*\*8\*\*/);
});
