import assert from "node:assert/strict";
import test from "node:test";
import { placementBandPresentation } from "./placementBand";

test("kid placement is bright, simple, and hides analytical completion metrics", () => {
  const kid = placementBandPresentation("kid");
  assert.equal(kid.defaultDark, false);
  assert.equal(kid.allowThemeToggle, false);
  assert.equal(kid.showCompletionMetrics, false);
  assert.equal(kid.continueLabel, "Let’s play");
});

test("student placement is the neutral light baseline", () => {
  const student = placementBandPresentation("student");
  assert.equal(student.defaultDark, false);
  assert.equal(student.allowThemeToggle, true);
  assert.equal(student.showCompletionMetrics, true);
});

test("focus placement defaults to the dark study-tool treatment", () => {
  const focus = placementBandPresentation("focus");
  assert.equal(focus.defaultDark, true);
  assert.equal(focus.allowThemeToggle, true);
  assert.equal(focus.continueLabel, "Continue to plan");
});
