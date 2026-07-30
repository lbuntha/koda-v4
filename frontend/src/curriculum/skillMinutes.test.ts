import assert from "node:assert/strict";
import test from "node:test";
import type { Skill } from "./types";
import {
  SKILL_MINUTES_MAX,
  SKILL_MINUTES_MIN,
  formatSkillMinutes,
  isValidSkillMinutes,
  sumSkillMinutes,
} from "./types";

const skill = (id: string, estimatedMinutes?: number): Skill => ({
  id,
  unitId: "unit-1",
  label: `Skill ${id}`,
  order: 1,
  minQuestions: 10,
  ...(estimatedMinutes === undefined ? {} : { presentation: { estimatedMinutes } }),
});

test("a skill's duration is the authored value, never an estimate", () => {
  assert.equal(formatSkillMinutes(skill("a", 5)), "5 min");
  assert.equal(formatSkillMinutes(skill("b", 1)), "1 min");
  // No `presentation` and an empty `presentation` both mean "the author has not said".
  assert.equal(formatSkillMinutes(skill("c")), null);
  assert.equal(formatSkillMinutes({ ...skill("d"), presentation: {} }), null);
});

test("minutes validation accepts blank and rejects anything outside the authored range", () => {
  assert.ok(isValidSkillMinutes(undefined));
  assert.ok(isValidSkillMinutes(SKILL_MINUTES_MIN));
  assert.ok(isValidSkillMinutes(SKILL_MINUTES_MAX));
  assert.ok(!isValidSkillMinutes(0));
  assert.ok(!isValidSkillMinutes(SKILL_MINUTES_MAX + 1));
  assert.ok(!isValidSkillMinutes(7.5));
});

test("the unit rollup sums what exists and counts what is missing", () => {
  assert.deepEqual(
    sumSkillMinutes([skill("a", 5), skill("b"), skill("c", 12), skill("d")]),
    { total: 17, missing: 2 },
  );
  assert.deepEqual(sumSkillMinutes([]), { total: 0, missing: 0 });
  // A unit where nothing is authored reports 0 rather than a guess.
  assert.deepEqual(sumSkillMinutes([skill("a"), skill("b")]), { total: 0, missing: 2 });
});
