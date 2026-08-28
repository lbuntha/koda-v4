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
 * XP per level.
 *
 * A hundred is two or three finished lessons at the shipped rate of 40 XP a
 * round, so a level is a session or two of real work — often enough to feel
 * like progress, rare enough to still mean something.
 *
 * Deliberately not a setting. `scoring.xpPerLevel` is already what one *lesson*
 * pays, and two configurable numbers with almost the same name is how a family
 * ends up unable to explain either.
 */
export const XP_PER_LEVEL = 100;

/**
 * The XP to count with.
 *
 * A record can arrive holding nonsense — a half-written sync, a hand-edited
 * store — and `Math.max(0, NaN)` is `NaN`, which would put "Level NaN" on a
 * child's profile. A learner is always somewhere, so the floor is zero.
 */
const lifetime = (xp: number): number => (Number.isFinite(xp) ? Math.max(0, xp) : 0);

/** The level this much lifetime XP has reached. A fresh learner is Level 1. */
export const levelFromXp = (xp: number): number =>
  Math.floor(lifetime(xp) / XP_PER_LEVEL) + 1;

/** XP earned since this level began, 0 to `XP_PER_LEVEL`. */
export const xpIntoLevel = (xp: number): number => lifetime(xp) % XP_PER_LEVEL;

/** XP still to earn before the next level. Never zero — that would be "arrived". */
export const xpToNextLevel = (xp: number): number => XP_PER_LEVEL - xpIntoLevel(xp);

/** How far through the current level, 0–1. For a bar. */
export const levelProgress = (xp: number): number => xpIntoLevel(xp) / XP_PER_LEVEL;
