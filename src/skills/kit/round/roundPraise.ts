import { levelFromXp, xpIntoLevel, XP_PER_LEVEL } from "../../../lib/level";

/**
 * What a finished round is congratulated *for*.
 *
 * The end screen used to say "Level 7 Mastered!" whatever had happened — the
 * same sentence for a first perfect round, for a tenth replay, and for the round
 * that carried a child into a new level. A message that never changes stops
 * being read, and a child who has just done something rare is told nothing about
 * it.
 *
 * So: name the single most notable true thing. One headline, not a wall of
 * badges — a screen that celebrates five things at once celebrates none of them,
 * and a five-year-old reads the biggest line and taps the button.
 *
 * The order below is the whole rule, and it is ordered by how *rare* the fact
 * is, not by how good it is:
 *
 *   1. a new level        — a session or two of work, across every skill
 *   2. a streak milestone — days in a row, which nothing but showing up earns
 *   3. a perfect round    — every question right first time, with no help
 *   4. the daily goal     — the thing the child was actually aiming at today
 *   5. stars              — always true, so it is what is left when nothing
 *                           above is
 *
 * A level lands above a perfect round on purpose: perfect rounds are common on
 * an easy lesson and a level is not, so leading with "perfect" on the round that
 * also made Level 5 would bury the bigger news.
 */

/** Streak lengths worth stopping for. Between them the flame is just shown. */
export const STREAK_MILESTONES = [3, 5, 7, 10, 14, 21, 30, 50, 75, 100] as const;

export type PraiseKind = "levelUp" | "streak" | "perfect" | "goal" | "stars";

export interface PraiseFacts {
  stars: 1 | 2 | 3;
  /** Every question right first time, with no help taken. */
  perfect: boolean;
  /** XP this round paid. */
  xpWon: number;
  /** Lifetime XP *including* this round. */
  xpAfter: number;
  /** Days (or weeks) of streak, as the learner's cadence counts them. */
  streakDays: number;
  /** Whether the streak counts days or weeks, so the wording can say which. */
  cadence?: "daily" | "weekly";
  /** Rounds finished today, and how many the learner was aiming for. */
  dailySolved: number;
  dailyGoal: number;
}

export interface RoundPraise {
  /** Which fact won, so the screen can pick an icon and a test can assert. */
  kind: PraiseKind;
  /** The small line above the headline. */
  tag: string;
  /** The big line. One achievement, named. */
  headline: string;
  /** A sentence under it, saying what it means. Never a second achievement. */
  note: string;
}

const isMilestone = (days: number): boolean =>
  (STREAK_MILESTONES as readonly number[]).includes(days);

/** "day" / "days", or the weekly learner's "week" / "weeks". */
const unit = (n: number, cadence: PraiseFacts["cadence"]): string => {
  const word = cadence === "weekly" ? "week" : "day";
  return n === 1 ? word : `${word}s`;
};

/**
 * Whether this round's XP carried the learner over a level boundary.
 *
 * Compared across the round rather than read from the record, because the level
 * is derived from XP and both sides of the subtraction are known here. A round
 * that paid no XP cannot have levelled anybody up, whatever the arithmetic says.
 */
export const levelledUp = (xpAfter: number, xpWon: number): boolean =>
  xpWon > 0 && levelFromXp(xpAfter) > levelFromXp(xpAfter - xpWon);

export function roundPraise(facts: PraiseFacts): RoundPraise {
  const { stars, perfect, xpWon, xpAfter, streakDays, cadence, dailySolved, dailyGoal } = facts;

  if (levelledUp(xpAfter, xpWon)) {
    return {
      kind: "levelUp",
      tag: "New level",
      headline: `Level ${levelFromXp(xpAfter)}!`,
      note: "Every round you have ever played added up to this.",
    };
  }

  if (isMilestone(streakDays)) {
    return {
      kind: "streak",
      tag: "Streak",
      headline: `${streakDays} ${unit(streakDays, cadence)} in a row!`,
      // Said about the child rather than the number: showing up is the habit
      // the streak exists to build, and it is the part they control.
      note: "You keep coming back. That is the hard part, and you are doing it.",
    };
  }

  if (perfect) {
    return {
      kind: "perfect",
      tag: "Perfect round",
      headline: "Every single one!",
      note: "Right first time, all the way through. No hints needed.",
    };
  }

  // Met today, this round — not "met today", which would repeat on every round
  // after it and turn the one moment worth marking into wallpaper.
  if (dailyGoal > 0 && dailySolved >= dailyGoal && dailySolved - 1 < dailyGoal) {
    return {
      kind: "goal",
      tag: "Goal met",
      headline: "That is today's goal!",
      note: `${dailyGoal} ${dailyGoal === 1 ? "round" : "rounds"} done. Anything more today is extra.`,
    };
  }

  const byStars: Record<1 | 2 | 3, { headline: string; note: string }> = {
    3: {
      headline: "Brilliantly done!",
      note: "Nearly all of them right first time.",
    },
    2: {
      headline: "Nicely done!",
      note: "You worked some of those out the hard way, and you got there.",
    },
    1: {
      headline: "You finished it!",
      note: "Some of those were tricky. Finishing anyway is what counts.",
    },
  };

  return { kind: "stars", tag: "Round complete", ...byStars[stars] };
}

/** How far into the current level, for the bar under the XP. */
export const levelBar = (xp: number) => ({
  level: levelFromXp(xp),
  into: xpIntoLevel(xp),
  per: XP_PER_LEVEL,
  toNext: XP_PER_LEVEL - xpIntoLevel(xp),
});
