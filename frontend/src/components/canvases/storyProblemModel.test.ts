import assert from "node:assert/strict";
import test from "node:test";
import { allowedUnknowns, answerChoices, normalizeStoryProblemConfig, storyAnswer, storyEquation } from "./storyProblemModel";

test("joining and three-addend stories stay within 20", () => {
  const joining = normalizeStoryProblemConfig({ type: "add_to", first: 18, second: 9 });
  assert.equal(storyAnswer(joining), 20);
  const three = normalizeStoryProblemConfig({ type: "three_addends", first: 12, second: 7, third: 9 });
  assert.equal(storyAnswer(three), 20);
});

test("separating stories never remove more than the starting amount", () => {
  const config = normalizeStoryProblemConfig({ type: "take_from", first: 4, second: 10 });
  assert.equal(config.second, 4);
  assert.equal(storyAnswer(config), 0);
});

test("comparison stories preserve the larger and smaller authored groups", () => {
  const config = normalizeStoryProblemConfig({ type: "compare", first: 3, second: 7 });
  assert.equal(config.first, 7);
  assert.equal(config.second, 3);
  assert.equal(storyAnswer(config), 4);
});

test("unknown positions produce the matching answer and equation", () => {
  const config = normalizeStoryProblemConfig({ type: "add_to", unknown: "change", first: 6, second: 5 });
  assert.equal(storyAnswer(config), 5);
  assert.equal(storyEquation(config), "6 + ? = 11");
  assert.deepEqual(allowedUnknowns("compare"), ["result"]);
});

test("answer choices are unique, ordered, and include the answer", () => {
  const choices = answerChoices(0, [0, 1, 1, 50]);
  assert.deepEqual(choices, [0, 1, 2, 3]);
});
