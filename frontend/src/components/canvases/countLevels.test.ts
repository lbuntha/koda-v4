/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The counting ladder, checked the way the Liquid Sort ladder is checked: not "does the table
 * parse" but "would a child be able to finish every level, and does the order mean anything".
 *
 * The checks mirror `scripts/exportCountLevels.ts` so a broken row fails here at `npm test`
 * rather than at export time. Both read the constraint from the technique's own AI schema
 * instead of restating it, so a canvas can never be asked for a board the studio would reject.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { COUNT_CURRICULUM_LEVELS, TIER_ORDER, levelsForTier, type CountLevel } from "./countLevels";
import { SCHEMA_REGISTRY } from "../studio/ai-generator/schemas";
import { solvedSelection } from "../../student/answerSelection";
import type { CountingQuestion } from "../../types";

const asQuestion = (level: CountLevel): CountingQuestion => ({
  id: level.id,
  technique: level.technique,
  title: level.label,
  instruction: "Count them all.",
  objectId: "apple",
  targetCount: level.targetCount,
  config: { ...level.config },
} as CountingQuestion);

const schemaFor = (technique: string) =>
  SCHEMA_REGISTRY.find(schema => schema.technique === technique);

describe("the counting ladder", () => {
  test("every level asks a count its canvas actually accepts", () => {
    for (const level of COUNT_CURRICULUM_LEVELS) {
      const schema = schemaFor(level.technique);
      assert.ok(schema, `${level.id}: ${level.technique} has no schema — retired component?`);
      const { min, max } = schema!.topLevelFields.targetCount;
      assert.ok(
        level.targetCount >= min && level.targetCount <= max,
        `${level.id}: count ${level.targetCount} outside ${level.technique} range ${min}-${max}`,
      );
    }
  });

  test("every level's config solves to the answer the level claims", () => {
    // This is the counting equivalent of playing the board out: `solvedSelection` is what
    // GameLauncher submits when a child finishes, so a mismatch here is a child being marked
    // wrong for the right answer.
    for (const level of COUNT_CURRICULUM_LEVELS) {
      const reported = solvedSelection(asQuestion(level));
      assert.notEqual(reported, null, `${level.id}: ${level.technique} derives no answer`);
      assert.equal(
        Number(reported), level.targetCount,
        `${level.id}: config solves to ${reported}, level claims ${level.targetCount}`,
      );
    }
  });

  test("no two levels are the same question with a different label", () => {
    const seen = new Map<string, string>();
    for (const level of COUNT_CURRICULUM_LEVELS) {
      const fingerprint = `${level.technique}:${level.targetCount}:${JSON.stringify(level.config)}`;
      assert.equal(seen.get(fingerprint), undefined, `${level.id} duplicates ${seen.get(fingerprint)}`);
      seen.set(fingerprint, level.id);
    }
  });

  test("counts climb within a technique, and tiers never go backwards", () => {
    for (const tier of TIER_ORDER) {
      for (const technique of new Set(COUNT_CURRICULUM_LEVELS.map(l => l.technique))) {
        const run = COUNT_CURRICULUM_LEVELS.filter(l => l.tier === tier && l.technique === technique);
        for (let i = 1; i < run.length; i++) {
          assert.ok(
            run[i].targetCount >= run[i - 1].targetCount,
            `${run[i].id}: ${run[i].targetCount} follows ${run[i - 1].targetCount}`,
          );
        }
      }
    }
    const rank = (tier: string) => TIER_ORDER.indexOf(tier as any);
    for (let i = 1; i < COUNT_CURRICULUM_LEVELS.length; i++) {
      assert.ok(
        rank(COUNT_CURRICULUM_LEVELS[i].tier) >= rank(COUNT_CURRICULUM_LEVELS[i - 1].tier),
        `${COUNT_CURRICULUM_LEVELS[i].id} drops back to an earlier tier`,
      );
    }
  });

  test("ids are unique and every tier has levels", () => {
    const ids = COUNT_CURRICULUM_LEVELS.map(l => l.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate level id");
    for (const tier of TIER_ORDER) {
      assert.ok(levelsForTier(tier).length > 0, `tier ${tier} is empty`);
    }
  });

  test("the ladder hands off between canvases as the count grows", () => {
    // The property that makes this ladder different from Liquid Sort's: no counting canvas
    // spans the whole range, so past twelve the strategy — not just the number — has to change.
    const smallest = COUNT_CURRICULUM_LEVELS[0];
    const largest = COUNT_CURRICULUM_LEVELS[COUNT_CURRICULUM_LEVELS.length - 1];
    assert.notEqual(smallest.technique, largest.technique);
    assert.ok(largest.targetCount > 12, "the ladder should climb past one-to-one's ceiling");
  });
});
