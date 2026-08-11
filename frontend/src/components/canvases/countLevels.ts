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
  /**
   * The artwork this level is about, when the picture is part of the lesson.
   *
   * Almost every row leaves this alone: whether a child counts apples or ducks
   * is theming, and the export picks one. A base-ten rod is not theming — the
   * level *is* the rod — so a row that needs particular artwork says so, and
   * `config.assetType` must name the same thing.
   */
  objectId?: string;
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

  {
    id: "count_15",
    label: "Five into the jar",
    rationale: "Nothing to line up and nowhere wrong to put it — the count is the only thing being asked for.",
    tier: "starter",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 5,
    config: { staging: "container", containerShape: "jar", requireAnswerInput: false },
  },

  // ── Developing: the layout stops helping ───────────────────────────────────────
  {
    id: "count_5",
    label: "Seven in a circle",
    rationale: "A circle has no first or last object, so the child must choose a start and remember it.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 7,
    config: { staging: "arrangements", pattern: "circle", requireAnswerInput: true },
  },
  {
    id: "count_6",
    label: "Nine in a grid",
    rationale: "A grid rewards counting by rows — the first arrangement where a strategy beats one-by-one.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 9,
    config: { staging: "arrangements", pattern: "grid", requireAnswerInput: true },
  },
  {
    id: "count_7",
    label: "Ten scattered",
    rationale: "Scatter is the real test of one-to-one: nothing on screen says which have been counted.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 10,
    config: { staging: "arrangements", pattern: "scatter", requireAnswerInput: true },
  },
  {
    id: "count_8",
    label: "Twelve scattered",
    rationale: "The top of what tracking alone can carry — and the reason the next tier changes strategy.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 12,
    config: { staging: "arrangements", pattern: "scatter", requireAnswerInput: true },
  },

  {
    id: "count_16",
    label: "Nine into the basket",
    rationale: "The same free placement at a count where the child has to keep track of what already went in.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 9,
    config: { staging: "container", containerShape: "basket", requireAnswerInput: true },
  },
  {
    id: "count_17",
    label: "Eight moved across",
    rationale: "Moving each one is its own record: what is left in the first bin is what is still to count.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 8,
    config: { staging: "move", requireAnswerInput: true },
  },
  {
    id: "count_18",
    label: "Twelve moved across",
    rationale: "Past what tracking alone carries, so the act of moving is doing the remembering.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 12,
    config: { staging: "move", requireAnswerInput: true },
  },
  {
    id: "count_19",
    label: "Six onto numbered places",
    rationale: "The first level where the slot is the number — being fifth is not the same as there being five.",
    tier: "developing",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 6,
    config: { staging: "lineup", requireAnswerInput: true },
  },

  // ── Secure: counting on instead of starting over ───────────────────────────────
  {
    id: "count_20",
    label: "Ten onto numbered places",
    rationale: "Ordinality at a count that spans two hands, which is where the numbered places start to earn it.",
    tier: "secure",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 10,
    config: { staging: "lineup", requireAnswerInput: true },
  },
  {
    id: "count_9",
    label: "Count on from five",
    rationale: "Five are already in the jar. Recounting them is the habit this level is built to break.",
    tier: "secure",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 8,
    config: { staging: "counton", baseCount: 5, extraCount: 3, requireAnswerInput: true },
  },
  {
    id: "count_10",
    label: "Count on from ten",
    rationale: "Counting on from a ten is the bridge to teen numbers, which the next tier depends on.",
    tier: "secure",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 14,
    config: { staging: "counton", baseCount: 10, extraCount: 4, requireAnswerInput: true },
  },
  {
    id: "count_11",
    label: "Count back from twelve",
    rationale: "The same move in reverse. Counting back is where addition-only counting comes apart.",
    tier: "secure",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 8,
    config: { staging: "countback", totalCount: 12, removeCount: 4, requireAnswerInput: true },
  },

  {
    id: "count_21",
    label: "Twelve socks, counted in twos",
    rationale: "Pairs are the first bundle a child already believes in, so twos is where skip counting starts.",
    tier: "secure",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 12,
    config: { staging: "skipcount", totalCount: 12, skipStep: 2, requireAnswerInput: true },
  },

  /*
    ── Extending: past twelve, grouping is the skill ────────────────────────────

    Four rungs, and each one adds exactly one idea: what a ten *is*, then a ten
    with something left over, then a leftover big enough that the ten has to be
    held rather than recounted, then two of them.

    Two things are deliberate across all four.

    The numbered cells are on for the first rung only. They are a training wheel
    that competes with the thing being taught — a counted object already wears
    its own number, so a numbered cell is the same digit printed twice, and the
    child who reads "13" off the last cell has read the answer instead of the
    frame. They earn their place exactly once, on the board where the frame
    itself is new and nobody has said yet how many it holds.

    And the bins are "Ones" and "Tens", the staging's own defaults, rather than
    the "Loose beads" these rows used to override the first one with. The
    artwork is not beads, so the label was simply wrong — and *ones* is the word
    the rest of the maths uses for what is in that bin.
  */
  {
    id: "count_25",
    label: "Fill one ten",
    rationale:
      "What a ten is, before anything is left over. One frame, exactly full — the child sees ten ones become one thing, which every later rung assumes and none of them taught.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 10,
    config: { staging: "tens", showNumbersInSlots: true, requireAnswerInput: true },
  },
  {
    id: "count_12",
    label: "One ten and three",
    rationale:
      "The first leftover. Counting one-by-one is now the wrong answer — the full frame is read as ten and the three are counted on from it.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 13,
    config: { staging: "tens", showNumbersInSlots: false, requireAnswerInput: true },
  },
  {
    id: "count_13",
    label: "One ten and seven",
    rationale:
      "A leftover too big to take in at a glance, so the ten has to be held while the ones are counted — the point at which the frame is doing real work.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 17,
    config: { staging: "tens", showNumbersInSlots: false, requireAnswerInput: true },
  },
  {
    id: "count_14",
    label: "Two full tens",
    rationale:
      "Two tens and no ones: the answer is read off the frames alone, which is the doorway to place value and the top of this ladder.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 20,
    config: { staging: "tens", showNumbersInSlots: false, requireAnswerInput: true },
  },
  {
    id: "count_22",
    label: "Twenty counted in fives",
    rationale: "Fives past ten: the point where counting one at a time is visibly the slower way to be right.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 20,
    config: { staging: "skipcount", totalCount: 20, skipStep: 5, requireAnswerInput: true },
  },
  {
    id: "count_23",
    label: "Forty counted in tens",
    rationale:
      "The first board where a single object is worth ten. Four rods, forty blocks — the child says the tens and reads the total off them, which is counting turning into place value.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 40,
    objectId: "tenrod",
    config: { staging: "skipcount", totalCount: 40, skipStep: 10, assetType: "tenrod", requireAnswerInput: true },
  },
  {
    id: "count_24",
    label: "Ninety counted in tens",
    rationale:
      "Same act, past the point where one-at-a-time is even tempting: nine rods is nine words, ninety cubes is not something a child will ever count twice.",
    tier: "extending",
    technique: CountingTechnique.MOVE_AND_COUNT,
    targetCount: 90,
    objectId: "tenrod",
    config: { staging: "skipcount", totalCount: 90, skipStep: 10, assetType: "tenrod", requireAnswerInput: true },
  },
];

export const TIER_ORDER: readonly CountTier[] = ["starter", "developing", "secure", "extending"];

/** The level a skill should start from, by id. Absent means "start at the beginning". */
export function levelsForTier(tier: CountTier): CountLevel[] {
  return COUNT_CURRICULUM_LEVELS.filter(level => level.tier === tier);
}
