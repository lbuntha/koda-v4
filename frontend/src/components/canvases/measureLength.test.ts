/**
 * Measure Length's labels and colours have to agree with each other.
 *
 * The bars are named RED / BLUE / GREEN, so they must actually be drawn in those colours —
 * a green bar captioned "RED" is a contradiction a six-year-old notices immediately, and it
 * makes "tap the shortest" ambiguous about which thing is being named. The label is written
 * in the bar's own ink for the same reason.
 *
 * Yellow is deliberately absent from the palette: on a light worksheet it is simultaneously
 * low-contrast and high-glare, which is tiring to look at for a whole lesson.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BAR_COLOURS,
  barColour,
  labelColour,
  UNNAMED,
  isPlaceholderLabel,
  measureAnswer,
  normalizeMeasureConfig,
} from "./MeasureLengthCanvas";

const DEFAULTS = ["Red", "Blue", "Green"];

test("each default label names the colour its bar is actually drawn in", () => {
  const config = normalizeMeasureConfig({ task: "longest", lengths: [3, 6, 4] });
  assert.deepEqual(config.labels, DEFAULTS);
  const expected = ["rose", "sky", "emerald"]; // red, blue, green
  config.labels.forEach((label, index) => {
    for (const isDark of [false, true]) {
      assert.ok(
        barColour(index, isDark).includes(expected[index]),
        `${label} bar is ${barColour(index, isDark)}, not ${expected[index]}`,
      );
      assert.ok(
        labelColour(index, isDark).includes(expected[index]),
        `${label} label ink is ${labelColour(index, isDark)}, not ${expected[index]}`,
      );
    }
  });
});

test("the label is written in the same hue as its bar", () => {
  for (let index = 0; index < BAR_COLOURS.length + 2; index++) {
    for (const isDark of [false, true]) {
      const hue = barColour(index, isDark).replace(/^bg-/, "").split("-")[0];
      assert.ok(
        labelColour(index, isDark).startsWith(`text-${hue}-`),
        `bar ${index} is ${hue} but its label is ${labelColour(index, isDark)}`,
      );
    }
  }
});

test("no bar or label is ever yellow", () => {
  for (let index = 0; index < BAR_COLOURS.length + 4; index++) {
    for (const isDark of [false, true]) {
      for (const cls of [barColour(index, isDark), labelColour(index, isDark)]) {
        assert.ok(!/amber|yellow/.test(cls), `bar ${index} uses ${cls}`);
      }
    }
  }
});

test("a single measured bar is not given a colour name it cannot live up to", () => {
  // There is nothing to tell it apart from, so "Red" was noise on top of being wrong.
  const config = normalizeMeasureConfig({ task: "measure", lengths: [3] });
  assert.deepEqual(config.labels, ["Bar"]);
  assert.equal(measureAnswer(config), 3);
});

test("an author who names the thing being measured keeps their name", () => {
  const config = normalizeMeasureConfig({ task: "measure", lengths: [7], labels: ["Pencil"] });
  assert.deepEqual(config.labels, ["Pencil"]);
});

test("a lone measured bar drops an inherited colour name", () => {
  // Questions authored before the measure task stopped defaulting to colour names still carry
  // measureLabels: ["Red"]. Rendered, that is a green bar captioned RED in green ink.
  for (const stale of ["Red", "red", " GREEN ", "Bar", "Bar 1"]) {
    const config = normalizeMeasureConfig({ task: "measure", lengths: [6], labels: [stale] });
    assert.deepEqual(config.labels, [UNNAMED], `"${stale}" should not survive as a name`);
  }
});

test("the compare tasks keep their colour names, which are not placeholders to them", () => {
  const config = normalizeMeasureConfig({ task: "shortest", lengths: [5, 2, 7] });
  assert.deepEqual(config.labels, DEFAULTS);
  assert.equal(measureAnswer(config), 2);
});

test("isPlaceholderLabel is what the panel uses to show an empty name box", () => {
  assert.ok(isPlaceholderLabel("Red"));
  assert.ok(isPlaceholderLabel("bar"));
  assert.ok(!isPlaceholderLabel("Pencil"));
  assert.ok(!isPlaceholderLabel("My ribbon"));
});
