import assert from "node:assert/strict";
import test from "node:test";
import { allowedUnknowns, answerChoices, normalizeStoryProblemConfig, pluralise, storyAnswer, storyEquation, storyText } from "./storyProblemModel";

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

// ── The story itself ─────────────────────────────────────────────────────────────
// The mat used to render `question.instruction || storyText(...)`, and every seeded question
// carries the generic "Read the story, then choose the number that answers it." — so the
// instruction won and the story was never drawn. The child saw a mat telling them to read a
// story that was not on screen, beside two groups of counters: bare arithmetic, with the
// word-problem skill the activity exists to teach quietly removed.

const story = (overrides: Parameters<typeof normalizeStoryProblemConfig>[0]) =>
  normalizeStoryProblemConfig({ characterName: "Koda", scene: "park", ...overrides });

test("every story type produces a real sentence that asks a question", () => {
  const cases = [
    story({ type: "add_to", unknown: "result", first: 4, second: 3 }),
    story({ type: "add_to", unknown: "change", first: 5, second: 4 }),
    story({ type: "add_to", unknown: "start", first: 6, second: 5 }),
    story({ type: "take_from", unknown: "result", first: 9, second: 3 }),
    story({ type: "take_from", unknown: "change", first: 12, second: 5 }),
    story({ type: "put_together", unknown: "result", first: 3, second: 4 }),
    story({ type: "put_together", unknown: "part", first: 6, second: 3 }),
    story({ type: "take_apart", first: 10, second: 4 }),
    story({ type: "compare", first: 7, second: 4 }),
    story({ type: "three_addends", first: 2, second: 3, third: 4 }),
  ];
  for (const config of cases) {
    const text = storyText(config, "Apple");
    assert.ok(text.length > 20, `${config.type}/${config.unknown} produced no story`);
    assert.ok(text.includes("Koda"), `${config.type}/${config.unknown} lost the character`);
    assert.ok(text.trim().endsWith("?"), `${config.type}/${config.unknown} asks nothing: "${text}"`);
  }
});

test("a story with a hidden quantity says so instead of stating it", () => {
  assert.match(storyText(story({ type: "add_to", unknown: "change", first: 5, second: 4 }), "Apple"), /Some more arrived/);
  assert.match(storyText(story({ type: "add_to", unknown: "start", first: 6, second: 5 }), "Apple"), /had some/);
  assert.match(storyText(story({ type: "take_from", unknown: "change", first: 12, second: 5 }), "Apple"), /Some went away/);
});

test("the thing being counted is pluralised the way English actually does it", () => {
  // "butterflys" was being shown to children who are still learning to read.
  assert.equal(pluralise("Butterfly"), "butterflies");
  assert.equal(pluralise("Apple"), "apples");
  assert.equal(pluralise("Fish"), "fish");
  assert.equal(pluralise("Star"), "stars");
  assert.equal(pluralise("apples"), "apples");
  assert.equal(pluralise("Box"), "boxes");
  assert.equal(pluralise("Dish"), "dishes");
});

test("the story reads with the pluralised object", () => {
  const config = story({ type: "add_to", unknown: "result", first: 4, second: 3 });
  assert.equal(storyText(config, "Butterfly"), "Koda had 4 butterflies. 3 more arrived. How many are there now?");
  assert.equal(storyText(config, "Fish"), "Koda had 4 fish. 3 more arrived. How many are there now?");
});
