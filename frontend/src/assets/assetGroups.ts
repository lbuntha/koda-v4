/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Artwork that is already a group.
 *
 * Almost every picture in the catalog draws one thing: an apple is an apple, and
 * a board of six of them is six. A base-ten rod is not that. It is a picture of
 * ten, drawn as ten, and a board of six rods is sixty — which is the entire
 * reason a rod teaches anything.
 *
 * That makes "how many does this picture stand for" a property of the *asset*,
 * not of the slide, and two places need the answer:
 *
 *   - the board, so it draws one rod per bundle instead of ten rods per bundle;
 *   - `boardTotals`, so the answer panel expects sixty rather than six.
 *
 * They must agree, so the fact lives here once. This module deliberately imports
 * nothing: `boardTotals` is read by `solvedSelection`, which runs with no DOM and
 * must never pull artwork in behind it.
 */

export interface GroupedAsset {
  /** How many ones the picture stands for. */
  size: number;
  /** What one of those ones is called — the word the answer is counted in. */
  unit: string;
  /**
   * What one of these groups is called — "ten", not "group of 10".
   *
   * Skip Count's own words are written for loose things gathered up: a bin of
   * "Bundles of 10", finishing at "4 groups of 10 makes 40". None of that is
   * true of a rod. Nobody bundled it, and a child who is being taught to say
   * "four tens is forty" should not be reading "four groups of ten" while they
   * say it. Given as a word rather than left to the canvas because the canvas
   * has no way to know that a group of ten is called a ten.
   */
  groupName: string;
}

/**
 * Every asset that depicts a group rather than a thing.
 *
 * Keyed by the id a question stores in `config.assetType`. Anything absent is an
 * ordinary single object, which is all of them but this.
 */
export const GROUPED_ASSETS: Readonly<Record<string, GroupedAsset>> = {
  tenrod: { size: 10, unit: "block", groupName: "ten" },
};

/** What this artwork stands for, or `null` when it is just one thing. */
export const assetGroup = (assetType: unknown): GroupedAsset | null =>
  (typeof assetType === "string" ? GROUPED_ASSETS[assetType] : undefined) ?? null;

/** How many ones this artwork is worth, or `null` when it is worth one. */
export const assetGroupSize = (assetType: unknown): number | null =>
  assetGroup(assetType)?.size ?? null;
