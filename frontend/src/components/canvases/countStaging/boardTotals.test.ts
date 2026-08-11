/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What a skip-count board of grouped artwork comes to.
 *
 * These three numbers are the ones a child is graded against, and the base-ten
 * rod is the first asset whose *picture* changes them: it is worth ten whatever
 * the slide's `skipStep` says. A rule that lived in the staging alone would be
 * invisible to `solvedSelection`, which is what actually reports the answer — so
 * it lives here, and this is where it is pinned.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { boardTotals, skipStepOf } from "./boardTotals";

describe("skip counting with artwork that is already a group", () => {
  test("a rod board is one object per ten, and the answer is the ones", () => {
    const totals = boardTotals(
      { staging: "skipcount", assetType: "tenrod", skipStep: 10, totalCount: 40 },
      40,
    );
    assert.deepEqual(totals, { objects: 4, goal: 4, expected: 40 });
  });

  test("the rod outranks a stale skipStep rather than drawing the wrong board", () => {
    // Authored as fives, then switched to rods: sixty cubes marked as thirty is
    // the child being told they are wrong for reading the picture correctly.
    const totals = boardTotals(
      { staging: "skipcount", assetType: "tenrod", skipStep: 5, totalCount: 60 },
      60,
    );
    assert.equal(skipStepOf({ assetType: "tenrod", skipStep: 5 }), 10);
    assert.deepEqual(totals, { objects: 6, goal: 6, expected: 60 });
  });

  test("ordinary artwork still counts in whatever the slide says", () => {
    const totals = boardTotals({ staging: "skipcount", assetType: "apple", skipStep: 5, totalCount: 20 }, 20);
    assert.deepEqual(totals, { objects: 4, goal: 4, expected: 20 });
  });
});
