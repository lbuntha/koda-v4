/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The counting ladder — one ordered table of levels, the way `liquidSortLevels.ts` is one
 * ordered table of boards.
 *
 * A level here is not a new component. It is a number, a layout, and the strategy the child
 * is expected to reach for. Adding to the ladder is adding a row; every level becomes one
 * generated, verified question via `npm run export:count-levels`.
 *
 * ## Why the ladder changes technique as it climbs
 *
 * Liquid Sort's forty levels are all the same canvas, because a bottle board scales from 3
 * bottles to 12 without changing what the child does. Counting does not work that way, and
 * the authored ranges say so — every counting canvas is validated to a band:
 *
 *     MOVE_AND_COUNT 1-12   DIFFERENT_ARRANGEMENTS 3-12
 *     SUBITIZE 2-6          COUNT_ON 2-15            GROUP_IN_TENS 11-20
 *
 * The first four rows used to say ONE_TO_ONE. That technique was absorbed into Count, so they
 * now say MOVE_AND_COUNT and carry `staging: "tap"` — the same activity, named by what the
 * child does rather than by a component that no longer exists on its own.
 *
 * Past twelve, "tap each object once" stops being the skill — grouping into tens is. So the
 * ladder hands off between canvases as the number grows, and the difficulty dimensions are
 * count, layout, and whether the child may mark what they have already counted.
 *
 * The export refuses to emit a level whose count falls outside its technique's authored
 * range, so a row can never ask a canvas for something the studio itself would reject.
 */

import { CountingTechnique } from "../../types";

export type CountTier = "starter" | "developing" | "secure" | "extending";

export interface CountLevel {
  id: string;
  /** Shown to the author in the seed and the studio, not to the child. */
  label: string;
  /** What this level is for — why it sits here rather than earlier or later. */
  rationale: string;
  tier: CountTier;
  technique: CountingTechnique;
  /** The answer the child must arrive at. Also the count of objects on screen. */
  targetCount: number;
  config: Record<string, unknown>;
}

/**
 * Ordered easiest to hardest. `targetCount` never decreases inside a tier — the export
 * checks it, because a ladder that steps backwards teaches a child their effort was noise.
 */
export const COUNT_CURRICULUM_LEVELS: CountLevel[] = [
  // ── Starter: small counts, laid out so nothing can be missed ────────────────────
  {
    id: "count_1",
    label: "Three in a row",
    rationale: "The first win. A short line removes every tracking problem so the count is the only task.",
    tier: "starter",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 3,
    config: { staging: "tap", pattern: "line", showNumbersOnTap: true, requireAnswerInput: false },
  },
  {
    id: "count_2",
    label: "Five in a row",
    rationale: "Same layout, one hand's worth — the count children meet first outside school.",
    tier: "starter",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 5,
    config: { staging: "tap", pattern: "line", showNumbersOnTap: true, requireAnswerInput: false },
  },
  {
    id: "count_3",
    label: "Six in pairs",
    rationale: "Pairs break the line into groups, the first hint that counting need not be one at a time.",
    tier: "starter",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 6,
    config: { staging: "tap", pattern: "pairs", showNumbersOnTap: true, requireAnswerInput: false },
  },
  {
    id: "count_4",
    label: "Eight in a line, no numbers",
    rationale: "The tap numbers come off. The child now has to hold the running count themselves.",
    tier: "starter",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 8,
    config: { staging: "tap", pattern: "line", showNumbersOnTap: false, requireAnswerInput: true },
  },

  // ── Developing: the layout stops helping ───────────────────────────────────────
  {
    id: "count_5",
    label: "Seven in a circle",
    rationale: "A circle has no first or last object, so the child must choose a start and remember it.",
    tier: "developing",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    targetCount: 7,
    config: { pattern: "circle", requireAnswerInput: true },
  },
  {
    id: "count_6",
    label: "Nine in a grid",
    rationale: "A grid rewards counting by rows — the first arrangement where a strategy beats one-by-one.",
    tier: "developing",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    targetCount: 9,
    config: { pattern: "grid", requireAnswerInput: true },
  },
  {
    id: "count_7",
    label: "Ten scattered",
    rationale: "Scatter is the real test of one-to-one: nothing on screen says which have been counted.",
    tier: "developing",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    targetCount: 10,
    config: { pattern: "scatter", requireAnswerInput: true },
  },
  {
    id: "count_8",
    label: "Twelve scattered",
    rationale: "The top of what tracking alone can carry — and the reason the next tier changes strategy.",
    tier: "developing",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    targetCount: 12,
    config: { pattern: "scatter", requireAnswerInput: true },
  },

  // ── Secure: counting on instead of starting over ───────────────────────────────
  {
    id: "count_9",
    label: "Count on from five",
    rationale: "Five are already in the jar. Recounting them is the habit this level is built to break.",
    tier: "secure",
    technique: CountingTechnique.COUNT_ON,
    targetCount: 8,
    config: { baseCount: 5, extraCount: 3, containerShape: "jar", requireAnswerInput: true },
  },
  {
    id: "count_10",
    label: "Count on from ten",
    rationale: "Counting on from a ten is the bridge to teen numbers, which the next tier depends on.",
    tier: "secure",
    technique: CountingTechnique.COUNT_ON,
    targetCount: 14,
    config: { baseCount: 10, extraCount: 4, containerShape: "jar", requireAnswerInput: true },
  },
  {
    id: "count_11",
    label: "Count back from twelve",
    rationale: "The same move in reverse. Counting back is where addition-only counting comes apart.",
    tier: "secure",
    technique: CountingTechnique.COUNT_BACK,
    targetCount: 12,
    config: { totalCount: 12, removeCount: 4, crossOutStyle: "strike", requireAnswerInput: true },
  },

  // ── Extending: past twelve, grouping is the skill ──────────────────────────────
  {
    id: "count_12",
    label: "Make a ten from thirteen",
    rationale: "First level where counting one-by-one is the wrong answer: ten and three is faster and truer.",
    tier: "extending",
    technique: CountingTechnique.GROUP_IN_TENS,
    targetCount: 13,
    config: { sourceBinLabel: "Loose beads", showNumbersInSlots: true, requireAnswerInput: true },
  },
  {
    id: "count_13",
    label: "Make a ten from seventeen",
    rationale: "A fuller second group, so the ten is held while the ones are counted.",
    tier: "extending",
    technique: CountingTechnique.GROUP_IN_TENS,
    targetCount: 17,
    config: { sourceBinLabel: "Loose beads", showNumbersInSlots: false, requireAnswerInput: true },
  },
  {
    id: "count_14",
    label: "Make a ten from twenty",
    rationale: "Two full tens — the top of this ladder, and the doorway to place value.",
    tier: "extending",
    technique: CountingTechnique.GROUP_IN_TENS,
    targetCount: 20,
    config: { sourceBinLabel: "Loose beads", showNumbersInSlots: false, requireAnswerInput: true },
  },
];

export const TIER_ORDER: readonly CountTier[] = ["starter", "developing", "secure", "extending"];

/** The level a skill should start from, by id. Absent means "start at the beginning". */
export function levelsForTier(tier: CountTier): CountLevel[] {
  return COUNT_CURRICULUM_LEVELS.filter(level => level.tier === tier);
}
