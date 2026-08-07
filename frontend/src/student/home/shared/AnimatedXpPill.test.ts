import assert from "node:assert/strict";
import test from "node:test";

import { formatCompactXp } from "./AnimatedXpPill";

test("formatCompactXp keeps small totals and compacts thousands", () => {
  assert.equal(formatCompactXp(999), "999");
  assert.equal(formatCompactXp(1_000), "1k");
  assert.equal(formatCompactXp(1_100), "1.1k");
  assert.equal(formatCompactXp(12_450), "12.5k");
});

test("formatCompactXp handles invalid and very large totals", () => {
  assert.equal(formatCompactXp(-10), "0");
  assert.equal(formatCompactXp(Number.NaN), "0");
  assert.equal(formatCompactXp(1_000_000), "1m");
});
