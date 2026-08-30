import { ScoringAPI } from "../../../lib/scoring";

/**
 * How a finished round turns into stars and XP.
 *
 * One rule for every skill, because the rewards are shared: XP feeds one level,
 * stars fill one path, and a learner meets both across every skill they play.
 * When each skill scored itself, counting handed out a flat 3 stars and 100 XP
 * for finishing at all — accuracy was recorded in the log and ignored by the
 * reward — while addition paid 10 to 30 for the same round. Two scales in one
 * currency makes progress mean nothing, and every new skill made it worse.
 *
 * Stars come from first-try accuracy, not from finishing: a child who needed
 * three attempts on every question has finished the round, and has not mastered
 * it. The learning log already draws that distinction; this makes the reward
 * agree with it.
 */
export interface RoundScore {
  stars: 1 | 2 | 3;
  xp: number;
  /** Questions answered right first time, and how many there were. */
  correctFirstTry: number;
  total: number;
  /**
   * Every question right, first time, with no help.
   *
   * Not the same as three stars: the three-star band is a share a family can
   * lower, so a round can be worth three stars and still have had a wrong
   * answer in it. Praise that says "perfect" has to mean it.
   */
  perfect: boolean;
}

export interface RoundOutcome {
  /** Questions answered correctly on the first attempt, without support. */
  correctFirstTry: number;
  /** Questions in the round. */
  total: number;
}

export function scoreRound({ correctFirstTry, total }: RoundOutcome): RoundScore {
  // Read per round, never cached: the bands and shares are edited in Settings
  // and every skill is meant to pick the change up on its next round.
  const { twoStarShare, oneStarShare, xpPerLevel, threeStarAt, twoStarAt } =
    ScoringAPI.current();

  const accuracy = total > 0 ? correctFirstTry / Math.max(1, total) : 0;
  const stars: 1 | 2 | 3 = accuracy >= threeStarAt ? 3 : accuracy >= twoStarAt ? 2 : 1;

  const share = stars === 3 ? 1 : stars === 2 ? twoStarShare : oneStarShare;

  return {
    stars,
    xp: Math.round(xpPerLevel * share),
    correctFirstTry,
    total,
    perfect: total > 0 && correctFirstTry === total,
  };
}
