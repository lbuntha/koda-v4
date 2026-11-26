/**
 * The learner's level, from the XP they have earned.
 *
 * `UserProgress.level` has existed since the first commit and nothing has ever
 * written to it. The profile prints "Level 1" for a learner with 216 XP, and
 * would still print it at ten thousand — a number on screen that means nothing,
 * which is worse than no number.
 *
 * Derived rather than stored, for the same reason a streak is: XP is the record,
 * and a level is a way of reading it. Two devices that agree on XP cannot then
 * disagree on level, and there is no second figure to keep in step.
 *
 * This is also the answer to "what is XP for once the last badge is won". A
 * badge ladder ends unless somebody extends it; this does not. Every hundred XP
 * is another level, for as long as a learner keeps going, across every skill
 * they ever play.
 */

/**
 * Each level needs 100 XP more than the one before.
 *
 * Level 2 at 100 XP, 3 at 300, 4 at 600, 5 at 1,000, 10 at 4,500. A flat 100
 * per level (the first rule) made a level every two or three lessons, so
 * "NEW LEVEL" took over the end card after almost every round and a child on
 * lesson 2 of a skill read "Level 43" — the number meant nothing. Early levels
 * still come in a few rounds; later ones take a few weeks, so reaching one is
 * a moment again. XP itself is untouched: only how it is read changed.
 *
 * Deliberately not a setting. `scoring.xpPerLevel` is what one *lesson* pays,
 * and two configurable numbers with almost the same name is how a family ends
 * up unable to explain either.
 */
export const LEVEL_STEP = 100;

/**
 * The XP to count with.
 *
 * A record can arrive holding nonsense — a half-written sync, a hand-edited
 * store — and `Math.max(0, NaN)` is `NaN`, which would put "Level NaN" on a
 * child's profile. A learner is always somewhere, so the floor is zero.
 */
const lifetime = (xp: number): number => (Number.isFinite(xp) ? Math.max(0, xp) : 0);

/** Lifetime XP at which `level` begins. Level 1 begins at 0. */
export const levelStartXp = (level: number): number => (LEVEL_STEP / 2) * level * (level - 1);

/** XP needed to go from `level` to the next one. */
export const levelSize = (level: number): number => LEVEL_STEP * level;

/** The level this much lifetime XP has reached. A fresh learner is Level 1. */
export const levelFromXp = (xp: number): number => {
  const total = lifetime(xp);
  // The closed form, then nudged: floating point must never put a learner one
  // level off at the exact XP a level begins.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * total) / LEVEL_STEP)) / 2));
  while (levelStartXp(level + 1) <= total) level += 1;
  while (level > 1 && levelStartXp(level) > total) level -= 1;
  return level;
};

/** XP earned since this level began, 0 to `levelSize(level)`. */
export const xpIntoLevel = (xp: number): number => lifetime(xp) - levelStartXp(levelFromXp(xp));

/** XP still to earn before the next level. Never zero — that would be "arrived". */
export const xpToNextLevel = (xp: number): number => levelStartXp(levelFromXp(xp) + 1) - lifetime(xp);

/** The size of the level this XP is in: the bar's full width. */
export const currentLevelSize = (xp: number): number => levelSize(levelFromXp(xp));

/** How far through the current level, 0–1. For a bar. */
export const levelProgress = (xp: number): number => xpIntoLevel(xp) / currentLevelSize(xp);
