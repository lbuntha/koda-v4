/**
 * A studio panel must never write the answer into a question's title.
 *
 * `GameLauncher` renders `question.title` as the page `<h1>`, directly above the canvas, so a
 * title containing the answer hands it to the child before they touch anything. The Grade 1
 * recipes were fixed for this, but the panels regenerate title and instruction on every edit —
 * so a teacher nudging one slider was enough to put "Half past 2" or "Measure 3 units" back.
 *
 * The panels are React components, so rather than render them this asserts on the title
 * builders they use. Each case is a real config a panel can produce.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClockConfig } from "../../canvases/ClockCanvas";
import { measureAnswer, normalizeMeasureConfig } from "../../canvases/MeasureLengthCanvas";
import { dataAnswer, normalizeDataConfig } from "../../canvases/DataChartCanvas";
import { normalizeShapeConfig, shapeAnswer } from "../../canvases/ShapeLabCanvas";
import { equationAnswer, equationText, normalizeEquationConfig } from "../../canvases/EquationMatCanvas";

/** Mirrors ClockPanel. */
const clockTitle = () => "What time is it?";
/** Mirrors MeasureLengthPanel. */
const measureTitle = (task: string) => (task === "measure" ? "How long is the bar?" : `Find the ${task}`);
/** Mirrors DataChartPanel. */
const chartTitle = () => "Read the chart";
/** Mirrors ShapeLabPanel. */
const shapeTitle = (task: string) =>
  task === "compose" ? "Build the shape" : task === "shares" ? "Name the parts" : `Count the ${task}`;

const printsAnswer = (title: string, answer: number) => {
  const numbers: string[] = title.match(/\d+/g) ?? [];
  return numbers.includes(String(answer));
};

test("the clock panel never titles a question with the time it is showing", () => {
  for (const hour of [1, 2, 3, 10, 11, 12]) {
    for (const minute of [0, 30] as const) {
      const config = normalizeClockConfig({ hour, minute });
      assert.ok(
        !printsAnswer(clockTitle(), config.hour),
        `clock ${config.hour}:${minute} leaks through its title`,
      );
    }
  }
});

test("the measure panel never titles a question with the unit count", () => {
  for (const lengths of [[3], [5], [10], [12]]) {
    const config = normalizeMeasureConfig({ task: "measure", lengths });
    assert.ok(
      !printsAnswer(measureTitle(config.task), measureAnswer(config)),
      `measuring ${lengths[0]} units leaks through its title`,
    );
  }
  for (const task of ["longest", "shortest"] as const) {
    const config = normalizeMeasureConfig({ task, lengths: [3, 6, 4] });
    assert.ok(!printsAnswer(measureTitle(config.task), measureAnswer(config)), task);
  }
});

test("the chart and shape panels title the task, not the question", () => {
  const chart = normalizeDataConfig({ kind: "total", counts: [3, 5, 1] });
  assert.ok(!printsAnswer(chartTitle(), dataAnswer(chart)));

  for (const task of ["sides", "corners", "compose", "shares"] as const) {
    const config = normalizeShapeConfig({ task, shape: "hexagon", shares: 4 });
    assert.ok(!printsAnswer(shapeTitle(config.task), shapeAnswer(config)), task);
  }
});

test("an equation title states the problem with the unknown blanked, never the answer", () => {
  for (const unknown of ["result", "first", "second"] as const) {
    const config = normalizeEquationConfig({ operation: "add", first: 8, second: 3, unknown });
    const title = equationText(config);
    assert.ok(title.includes("?"), `${unknown}: the unknown must show as "?" — got "${title}"`);
    // "8 + ? = 11" legitimately contains 8 and 11; what it must never contain is the answer
    // standing where the "?" is.
    const answer = equationAnswer(config);
    const blanked = title.split("=")[unknown === "result" ? 1 : 0];
    assert.ok(!printsAnswer(blanked, answer), `${unknown} leaks ${answer} through "${title}"`);
  }
});

test("a judge equation shows both sides in full and hides no term", () => {
  const config = normalizeEquationConfig({
    operation: "add", first: 5, second: 2, unknown: "judge", claimFirst: 3, claimSecond: 4,
  });
  assert.equal(equationText(config), "5 + 2 = 3 + 4");
  assert.ok(!equationText(config).includes("?"), "judge hides nothing — there is no unknown");
  // The answer is a verdict (1/0), so a digit in the title is a term, never the answer.
  assert.equal(equationAnswer(config), 1);
});
