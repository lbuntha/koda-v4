/**
 * What a finished round is worth.
 *
 * The same stars-and-XP rule as a lesson and a book, from the deployment's own
 * scoring settings, so a round of picture puzzles is worth what a lesson is:
 * nothing here invents a second economy. "First try" means solved with no hint
 * and no wrong answer before it, which is what a first-try answer means in a
 * lesson.
 */

import type { PuzzleOutcome } from "./engine";

export interface RebusScoring {
  xpPerLevel: number;
  threeStarAt: number;
  twoStarAt: number;
  twoStarShare: number;
  oneStarShare: number;
}

export const firstTry = (o: PuzzleOutcome): boolean => o.reason === "solved" && o.hintsUsed === 0 && o.wrong === 0;

export interface RebusReward {
  stars: 1 | 2 | 3;
  xp: number;
  /** Share of the puzzles solved on the first try, 0–1. */
  accuracy: number;
}

export const rebusReward = (outcomes: readonly PuzzleOutcome[], scoring: RebusScoring): RebusReward => {
  const accuracy = outcomes.length > 0 ? outcomes.filter(firstTry).length / outcomes.length : 0;
  const stars = accuracy >= scoring.threeStarAt ? 3 : accuracy >= scoring.twoStarAt ? 2 : 1;
  const share = stars === 3 ? 1 : stars === 2 ? scoring.twoStarShare : scoring.oneStarShare;
  return { stars, xp: Math.round(scoring.xpPerLevel * share), accuracy };
};
