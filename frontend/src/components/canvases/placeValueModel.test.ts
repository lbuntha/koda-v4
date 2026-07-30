import assert from "node:assert/strict";
import test from "node:test";
import { initialPlaceValueState, normalizePlaceValueConfig, placeValueChoices, representedNumber, targetPlaces } from "./placeValueModel";

test("place value targets stay within two digits", () => {
  assert.equal(normalizePlaceValueConfig({ target: 150 }).target, 99);
  assert.equal(normalizePlaceValueConfig({ target: 4 }).target, 10);
});

test("a two-digit number decomposes into tens and ones", () => {
  assert.deepEqual(targetPlaces(64), { tens: 6, ones: 4 });
  assert.equal(representedNumber({ tens: 6, ones: 4 }), 64);
});

test("regrouping begins with ten unbundled ones", () => {
  const config = normalizePlaceValueConfig({ task: "regroup_ones", target: 34 });
  assert.deepEqual(initialPlaceValueState(config), { tens: 2, ones: 14 });
  assert.equal(representedNumber(initialPlaceValueState(config)), 34);
});

test("read-number choices are unique and contain the target", () => {
  const choices = placeValueChoices(42);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.includes(42));
});
