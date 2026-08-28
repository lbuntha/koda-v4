import { afterEach, describe, expect, it } from "vitest";
import { ScoringAPI, SCORING_DEFAULTS } from "../../../lib/scoring";
import { scoreRound } from "./scoreRound";

/**
 * The reward rule, tested on its own.
 *
 * Worth isolating from any skill: this is the one place stars and XP are
 * decided, so a change here silently re-prices every skill at once. These are
 * the cases the rule exists to get right — a clean round, a scrappy one, and
 * the Settings values the owner is free to move.
 */
describe("scoreRound", () => {
  afterEach(() => ScoringAPI.update(SCORING_DEFAULTS));

  it("gives three stars for a clean round", () => {
    expect(scoreRound({ correctFirstTry: 5, total: 5 }).stars).toBe(3);
  });

  it("drops a star when a question needed a second attempt", () => {
    // 4/5 = 0.8, under the 0.9 three-star band.
    expect(scoreRound({ correctFirstTry: 4, total: 5 }).stars).toBe(2);
  });

  it("gives one star when most of the round was missed first time", () => {
    expect(scoreRound({ correctFirstTry: 1, total: 5 }).stars).toBe(1);
  });

  it("pays the full level XP only for three stars", () => {
    ScoringAPI.update({ xpPerLevel: 40, twoStarShare: 0.7, oneStarShare: 0.4 });
    expect(scoreRound({ correctFirstTry: 5, total: 5 }).xp).toBe(40);
    expect(scoreRound({ correctFirstTry: 4, total: 5 }).xp).toBe(28);
    expect(scoreRound({ correctFirstTry: 0, total: 5 }).xp).toBe(16);
  });

  it("follows the bands the owner sets in Settings", () => {
    // A stricter three-star band makes the same round worth less.
    ScoringAPI.update({ threeStarAt: 1, twoStarAt: 0.8 });
    expect(scoreRound({ correctFirstTry: 4, total: 5 }).stars).toBe(2);
    expect(scoreRound({ correctFirstTry: 5, total: 5 }).stars).toBe(3);
  });

  it("never scores below one star, even for a round with nothing right", () => {
    const score = scoreRound({ correctFirstTry: 0, total: 5 });
    expect(score.stars).toBe(1);
    expect(score.xp).toBeGreaterThanOrEqual(0);
  });
});
