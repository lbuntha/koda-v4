/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A ladder is an ordered table of levels — the array order *is* the difficulty ramp.
 *
 * Five modules in this codebase already have one (`liquidSortLevels`, `goodsSortLevels`,
 * `countCratesModel`, `countLevels`, `xtraMathLevels`) and each invented its own field
 * names, its own tier words — there are two vocabularies and three copies of the
 * rank table — and its own `find(id) || LEVELS[0]` lookup. This is that shape, once.
 *
 * A level names *how to build* its board, never the board itself: `{ params, seed }` is
 * about forty bytes, so a ladder can eventually travel with a release as data instead of
 * a bundled table, and new levels stop needing a frontend deploy.
 */

/** One vocabulary. Order is rank — `TIERS.indexOf` is the comparison. */
export const TIERS = ["beginner", "apprentice", "advanced", "master", "grandmaster"] as const;
export type Tier = (typeof TIERS)[number];

export interface LadderLevel<Params> {
  /** Stable id. Also the generator seed, so renaming a level rebuilds its board. */
  id: string;
  /** Shown to an adult choosing a level: "Level 4: Triple Tip". */
  title: string;
  /** One line on what makes this rung different from the one below. */
  blurb: string;
  tier: Tier;
  /** Everything the puzzle needs to lay out its solved board. */
  params: Params;
  /** How many legal moves to walk back from the solved board. */
  scramble: number;
  /**
   * The real difficulty dial, where scramble depth is not enough.
   *
   * On a small state space a random walk saturates — mixing a 4-disk Hanoi tower for 22
   * moves can leave it 3 moves from solved — so the ramp has to be stated as the shortest
   * solution the rung must require, and the generator searches seeds for a board that
   * delivers it. Leave it unset for puzzles where depth *is* distance, like a sliding
   * grid: it costs a solve per attempt.
   */
  minSolution?: number;
}

export interface Ladder<Params> {
  all: LadderLevel<Params>[];
  /** The level with this id, falling back to the first rung — never undefined. */
  getLevel(id?: string | null): LadderLevel<Params>;
  byTier(tier: Tier): LadderLevel<Params>[];
  /** 1-based position on the ladder, for "Level 7 of 40". */
  positionOf(id: string): number;
}

export function makeLadder<Params>(levels: LadderLevel<Params>[]): Ladder<Params> {
  if (levels.length === 0) throw new Error("[ladder] a ladder needs at least one level");
  const index = new Map(levels.map(level => [level.id, level]));

  return {
    all: levels,
    getLevel: (id) => (id ? index.get(id) : undefined) ?? levels[0],
    byTier: (tier) => levels.filter(level => level.tier === tier),
    positionOf: (id) => levels.findIndex(level => level.id === id) + 1,
  };
}
