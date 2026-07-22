/**
 * Addition Tutor — shared arithmetic model.
 *
 * The canvas, the Property Studio panel and the AI generator schema all derive
 * their numbers from here so they can never disagree about what a problem
 * means. Everything is pure and synchronous; there is no React in this file.
 *
 * Core invariant, asserted for every legal pair by the model's own definition:
 *
 *     totalTens * 10 + leftoverOnes === sum
 */

export interface TutorChallenge {
  num1: number;
  num2: number;
}

/** Both addends accept 1..99, giving 1+1, 2+1, 1+2 and 2+2 digit problems. */
export const ADDEND_MIN = 1;
export const ADDEND_MAX = 99;

export const clampAddend = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return ADDEND_MIN;
  return Math.min(ADDEND_MAX, Math.max(ADDEND_MIN, n));
};

/** "2+1" means a two-digit first addend and a one-digit second addend. */
export type DigitMode = "1+1" | "2+1" | "1+2" | "2+2";

export interface TutorModel {
  num1: number;
  num2: number;
  sum: number;
  tens1: number;
  ones1: number;
  tens2: number;
  ones2: number;
  /** Ones column before any regrouping — may exceed 9. */
  totalOnes: number;
  /** True when the ones column overflows and a ten must be carried. */
  needsRegroup: boolean;
  /** Ones to move from num2 to complete num1's ten frame; 0 when no regroup. */
  onesToMakeTen: number;
  /** Ones digit of the answer. */
  leftoverOnes: number;
  /** Tens digit(s) of the answer, carry included. */
  totalTens: number;
  digitMode: DigitMode;
  /** False for single-digit + single-digit with no carry — no rods appear at all. */
  hasTens: boolean;
}

export function buildTutorModel(rawNum1: unknown, rawNum2: unknown): TutorModel {
  const num1 = clampAddend(rawNum1);
  const num2 = clampAddend(rawNum2);

  const tens1 = Math.floor(num1 / 10);
  const ones1 = num1 % 10;
  const tens2 = Math.floor(num2 / 10);
  const ones2 = num2 % 10;

  const totalOnes = ones1 + ones2;
  const needsRegroup = totalOnes >= 10;
  const onesToMakeTen = needsRegroup ? 10 - ones1 : 0;
  const leftoverOnes = needsRegroup ? totalOnes - 10 : totalOnes;
  const totalTens = tens1 + tens2 + (needsRegroup ? 1 : 0);

  const digitMode = `${num1 >= 10 ? 2 : 1}+${num2 >= 10 ? 2 : 1}` as DigitMode;

  return {
    num1,
    num2,
    sum: num1 + num2,
    tens1,
    ones1,
    tens2,
    ones2,
    totalOnes,
    needsRegroup,
    onesToMakeTen,
    leftoverOnes,
    totalTens,
    digitMode,
    hasTens: totalTens > 0,
  };
}

/** Human label for the studio, e.g. "2-digit + 1-digit". */
export function describeDigitMode(mode: DigitMode): string {
  const [a, b] = mode.split("+");
  return `${a}-digit + ${b}-digit`;
}

/**
 * Derive practice problems that rehearse the same skill as the taught problem:
 * identical digit shape and identical regrouping behaviour, so a lesson about
 * carrying never ends on a problem that does not carry.
 *
 * Deterministic — the same inputs always yield the same list, so this can be
 * called during render without destabilising state.
 */
export function generateChallenges(num1: number, num2: number, count = 3): TutorChallenge[] {
  const target = buildTutorModel(num1, num2);
  const out: TutorChallenge[] = [];
  const seen = new Set<string>([`${target.num1}:${target.num2}`]);

  for (let spread = 1; spread <= 12 && out.length < count; spread++) {
    for (const [s1, s2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      if (out.length >= count) break;
      const a = target.num1 + s1 * spread;
      const b = target.num2 + s2 * spread;
      if (a < ADDEND_MIN || a > ADDEND_MAX || b < ADDEND_MIN || b > ADDEND_MAX) continue;

      const key = `${a}:${b}`;
      if (seen.has(key)) continue;

      const candidate = buildTutorModel(a, b);
      if (candidate.digitMode !== target.digitMode) continue;
      if (candidate.needsRegroup !== target.needsRegroup) continue;

      seen.add(key);
      out.push({ num1: a, num2: b });
    }
  }

  return out;
}

/** Coerce authored challenge rows into valid addends, dropping malformed entries. */
export function normaliseChallenges(raw: unknown): TutorChallenge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map(c => ({ num1: clampAddend(c.num1), num2: clampAddend(c.num2) }))
    .slice(0, 8);
}
