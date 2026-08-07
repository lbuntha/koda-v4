/**
 * Every Grade 1 Maths question, checked against the canvas that will actually play it.
 *
 * The export script (`npm run export:grade1-math`) checks a question's *shape* — ranges,
 * uniqueness, a title that does not give the answer away. What it cannot check is that the
 * canvas agrees: each canvas normalizes its authored config before play (clamping a second
 * addend so a sum stays under 20, forcing `take_apart` to a part-unknown, deriving a "ten
 * more" target from the start), and the answer the child is graded on comes out of *that*
 * normalized config, not out of the recipe.
 *
 * So these tests run every question through the canvas's own `normalize…` + `…Answer` pair
 * and assert it lands on the authored `targetCount`. A silent clamp that changes what a
 * question asks — the failure mode with no symptom, because everything still renders — fails
 * here instead of marking a child wrong.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GRADE_1_MATH_QUESTIONS } from "./grade1MathQuestions";
import { normalizeStoryProblemConfig, storyAnswer, allowedUnknowns } from "../components/canvases/storyProblemModel";
import { normalizeNumberPathConfig } from "../components/canvases/numberPathModel";
import { normalizeEquationConfig, equationAnswer } from "../components/canvases/EquationMatCanvas";
import { normalizeShapeConfig, shapeAnswer, shapePrompt, composition } from "../components/canvases/ShapeLabCanvas";
import { normalizeMeasureConfig, measureAnswer } from "../components/canvases/MeasureLengthCanvas";
import { normalizeDataConfig, dataAnswer, dataPrompt } from "../components/canvases/DataChartCanvas";
import { normalizeClockConfig } from "../components/canvases/ClockCanvas";
import { shapeForLabel } from "../assets/assetCatalog";

const questions = GRADE_1_MATH_QUESTIONS.flatMap(skill =>
  skill.questions.map(question => ({ ...question, config: question.config as Record<string, any> })),
);
const of = (technique: string) => questions.filter(question => question.technique === technique);

test("every question carries an explanation that is not just the prompt again", () => {
  for (const question of questions) {
    const explanation = String(question.config.explanation ?? "").trim();
    assert.ok(explanation, `${question.id} has no explanation`);
    assert.notEqual(explanation, question.instruction.trim(), `${question.id} explains nothing`);
  }
});

test("no title contains the answer", () => {
  // The title is rendered as the page <h1> above the canvas. Techniques whose title is the
  // problem written out are exempt: "8 + ? = 11" states the question, not the answer.
  const writesTheProblem = new Set([
    "EQUATION_MAT", "COMPARE_NUMBERS", "ADDITION_SANDBOX", "SUBTRACTION_SANDBOX",
    "ADDITION_COLUMN", "SUBTRACTION_COLUMN", "COUNT_ON", "COUNT_BACK",
  ]);
  for (const question of questions) {
    if (writesTheProblem.has(question.technique)) continue;
    const numbers: string[] = question.title.match(/\d+/g) ?? [];
    assert.ok(
      !numbers.includes(String(question.targetCount)),
      `${question.id}: title "${question.title}" prints the answer ${question.targetCount}`,
    );
  }
});

test("story problems solve to the answer the mat will grade", () => {
  for (const question of of("STORY_PROBLEM_MAT")) {
    const config = normalizeStoryProblemConfig({
      type: question.config.storyProblemType,
      unknown: question.config.storyUnknown,
      first: question.config.storyStart,
      second: question.config.storyPart2,
      third: question.config.storyPart3,
      characterName: question.config.storyCharacterName,
      scene: question.config.storyScene,
    });
    assert.equal(storyAnswer(config), question.targetCount, `${question.id} story answer`);
    // A rejected unknown is silently swapped for the first allowed one, which changes the
    // question without changing anything visible in the recipe.
    assert.equal(
      config.unknown, question.config.storyUnknown,
      `${question.id}: "${question.config.storyUnknown}" is not an allowed unknown for `
      + `${config.type} (${allowedUnknowns(config.type).join("/")})`,
    );
    assert.equal(config.first, question.config.storyStart, `${question.id} first was clamped`);
    assert.equal(config.second, question.config.storyPart2, `${question.id} second was clamped`);
  }
});

test("equation mats solve to the answer, including true/false judgements", () => {
  for (const question of of("EQUATION_MAT")) {
    const config = normalizeEquationConfig({
      operation: question.config.equationOperation,
      first: question.config.equationFirst,
      second: question.config.equationSecond,
      unknown: question.config.equationUnknown,
      claimFirst: question.config.equationClaimFirst,
      claimSecond: question.config.equationClaimSecond,
    });
    assert.equal(config.first, question.config.equationFirst, `${question.id} first was clamped`);
    assert.equal(config.second, question.config.equationSecond, `${question.id} second was clamped`);
    assert.equal(equationAnswer(config), question.targetCount, `${question.id} equation answer`);
  }
});

test("the equality skill asks for a judgement, not only for totals", () => {
  // Without a `judge` question a child can pass "the meaning of the equal sign" while still
  // reading "=" as "write the answer here" — which is the misconception 1.OA.D.7 targets.
  const equality = GRADE_1_MATH_QUESTIONS.find(skill => skill.skillId === "meaning-of-equal");
  const judged = equality!.questions.filter(q => (q.config as any).equationUnknown === "judge");
  assert.ok(judged.length >= 2, "expected at least two true/false questions");
  assert.deepEqual(
    [...new Set(judged.map(q => q.targetCount))].sort(),
    [0, 1],
    "a child who always answers True must not score full marks",
  );
});

test("number paths solve to the answer the chart will grade", () => {
  for (const question of of("NUMBER_PATH")) {
    const config = normalizeNumberPathConfig({
      view: question.config.numberChartView,
      task: question.config.numberChartTask,
      difficulty: question.config.numberChartDifficulty,
      start: question.config.numberChartStart,
      target: question.config.numberChartEnd,
    });
    assert.equal(config.target, question.targetCount, `${question.id} path target`);
  }
});

test("shape questions solve to the answer, and the instruction is the canvas prompt", () => {
  for (const question of of("SHAPE_LAB")) {
    const config = normalizeShapeConfig({
      task: question.config.shapeTask,
      shape: question.config.shapeName,
      shares: question.config.shapeShares,
    });
    assert.equal(shapeAnswer(config), question.targetCount, `${question.id} shape answer`);
    assert.equal(shapePrompt(config), question.instruction, `${question.id} prompt drift`);
  }
});

test("a composed shape names how many pieces it really takes", () => {
  // Two triangles make a square; it takes six to make a hexagon. Asking "which two shapes
  // join to make this hexagon" is simply false, and false is the one thing a maths
  // curriculum cannot be.
  assert.deepEqual(composition("square"), { part: "triangle", pieces: 2 });
  assert.deepEqual(composition("rectangle"), { part: "square", pieces: 2 });
  assert.deepEqual(composition("hexagon"), { part: "triangle", pieces: 6 });
  for (const question of of("SHAPE_LAB")) {
    if (question.config.shapeTask !== "compose") continue;
    const { pieces } = composition(question.config.shapeName);
    assert.match(question.instruction, new RegExp(`cut into ${pieces} equal pieces`), question.id);
  }
});

test("measurement questions solve to the answer the ruler will grade", () => {
  for (const question of of("MEASURE_LENGTH")) {
    const config = normalizeMeasureConfig({
      task: question.config.measureTask,
      lengths: question.config.measureLengths,
      labels: question.config.measureLabels,
    });
    assert.equal(measureAnswer(config), question.targetCount, `${question.id} measure answer`);
  }
});

test("data chart questions solve to the answer, and the instruction is the canvas prompt", () => {
  for (const question of of("DATA_CHART")) {
    const config = normalizeDataConfig({
      kind: question.config.dataKind,
      categories: question.config.dataCategories,
      counts: question.config.dataCounts,
      focus: question.config.dataFocus,
      against: question.config.dataAgainst,
    });
    assert.equal(dataAnswer(config), question.targetCount, `${question.id} chart answer`);
    assert.equal(dataPrompt(config), question.instruction, `${question.id} prompt drift`);
  }
});

/**
 * The column labelled "Pears" was drawn with flowers, and "Plums" with hearts, because the word
 * and the picture were authored as two independent lists. "How many Pears?" over a column
 * containing no pears is not a hard question, it is an unanswerable one.
 */
test("every chart column is drawn as the thing its label names", () => {
  for (const question of of("DATA_CHART")) {
    const categories: string[] = question.config.dataCategories ?? [];
    const assets: string[] = question.config.dataAssets ?? [];
    assert.ok(categories.length > 0, `${question.id} has no chart columns`);
    categories.forEach((name, index) => {
      assert.equal(
        assets[index],
        shapeForLabel(name),
        `${question.id} column "${name}" is drawn with ${assets[index] ?? "no"} artwork`,
      );
    });
  }
});

test("clock questions keep the hour the face is drawn from", () => {
  for (const question of of("CLOCK_READ")) {
    const config = normalizeClockConfig({
      hour: question.config.clockHour,
      minute: question.config.clockMinute,
    });
    assert.equal(config.hour, question.targetCount, `${question.id} clock hour`);
    assert.equal(config.minute, question.config.clockMinute, `${question.id} clock minute`);
  }
});
