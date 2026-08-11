/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The three numbers a counting board has, derived from its slide alone.
 *
 *   objects   how many things are on the board
 *   goal      how many acts finish the activity
 *   expected  the number the child enters, and the answer the app records
 *
 * They are the same number for most stagings and diverge for three: Count On is
 * authored as two parts, Count Back keeps back what it never touches, and Skip
 * Count acts on bundles rather than ones.
 *
 * ## Why this is not just in the stagings
 *
 * The stagings own these rules — but a staging is a React module, and two things
 * outside the canvas need the same answer:
 *
 *   - `solvedSelection` reports what a child answered, to analytics and to
 *     placement grading. It runs with no DOM and must not import artwork.
 *   - the curriculum ladder's tests check that a level claims the answer its
 *     board actually produces.
 *
 * Before this existed, `solvedSelection` guessed from config shape and got Count
 * Back wrong: it read `targetCount` first, so a board whose answer was "eight
 * left of twelve" reported twelve. The child was right and the record was not.
 *
 * So the derivation lives here, once, in plain TypeScript, and every staging's
 * `objectCount` / `goal` / `expectedAnswer` delegates to it. A staging that
 * needs a rule this file does not know about is a signal the rule belongs here,
 * not a licence to restate it.
 */

import { assetGroupSize } from "../../../assets/assetGroups";
import type { StagingConfig } from "./types";

export interface BoardTotals {
  /** Objects rendered on the board. */
  objects: number;
  /** Acts that finish the activity. */
  goal: number;
  /** What the answer panel checks, and what a solved board reports. */
  expected: number;
}

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Count On: a group already there, plus the ones being added to it. */
const countOnTotals = (config: StagingConfig): BoardTotals => {
  const base = Math.max(0, Number(config.baseCount ?? 5) || 0);
  const extra = num(config.extraCount, 3);
  const objects = base + extra;
  // Every object ends up counted, and the answer is all of them.
  return { objects, goal: objects, expected: objects };
};

/** Count Back: the whole set, some of it crossed out, and what survives. */
const countBackTotals = (config: StagingConfig, targetCount: number): BoardTotals => {
  const objects = num(config.totalCount, targetCount || 8);
  const goal = Math.min(objects, num(config.removeCount, 3));
  return { objects, goal, expected: objects - goal };
};

/**
 * How big one bundle is on a skip-count board.
 *
 * Usually the author's `skipStep`. But some artwork *is* the bundle — a base-ten
 * rod is ten, drawn as ten — and there the picture is the truth and the field is
 * a leftover: a board of rods left at `skipStep: 5` would draw six rods, sixty
 * cubes, and mark the child wrong for saying anything but thirty.
 *
 * So a grouped asset overrides the number, in the one place the board and the
 * answer panel both read it from.
 */
export const skipStepOf = (config: StagingConfig): number =>
  assetGroupSize(config.assetType) ?? num(config.skipStep, 5);

/** Skip Count: bundles of `step`, and the total they come to. */
const skipCountTotals = (config: StagingConfig, targetCount: number): BoardTotals => {
  const step = skipStepOf(config);
  const total = num(config.totalCount, targetCount || step * 4);
  // A total that is not a whole number of bundles would leave a part-bundle the
  // child cannot count in one act, so it is rounded up to the next whole one.
  const bundles = Math.max(1, Math.ceil(total / step));
  return { objects: bundles, goal: bundles, expected: bundles * step };
};

/**
 * What this slide's board comes to.
 *
 * `targetCount` is the fallback for every staging that counts a plain total —
 * which is most of them, and why they never mention any of this.
 */
export const boardTotals = (config: StagingConfig, targetCount: number): BoardTotals => {
  switch (config.staging) {
    case "counton":
      return countOnTotals(config);
    case "countback":
      return countBackTotals(config, targetCount);
    case "skipcount":
      return skipCountTotals(config, targetCount);
    default:
      return { objects: targetCount, goal: targetCount, expected: targetCount };
  }
};

/**
 * The same question for a slide that predates `config.staging`.
 *
 * Published releases carry a technique id and no staging, so the retired ids
 * have to keep meaning what they always meant — see `STAGING_BY_TECHNIQUE`.
 */
export const boardTotalsForTechnique = (
  technique: string,
  config: StagingConfig,
  targetCount: number
): BoardTotals => {
  if (config.staging) return boardTotals(config, targetCount);
  if (technique === "COUNT_ON") return countOnTotals(config);
  if (technique === "COUNT_BACK") return countBackTotals(config, targetCount);
  return { objects: targetCount, goal: targetCount, expected: targetCount };
};
