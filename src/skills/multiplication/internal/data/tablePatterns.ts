import { randInt, shuffle } from "./multiplicationNumbers";

/**
 * The patterns a times table holds, as data.
 *
 * A pattern hunt is only a task if the answer is a *proper* subset of the row.
 * "Tap every even answer in the twos" is every cell, which is a true observation
 * and a pointless selection — a child taps twelve times and has discriminated
 * nothing. So a rule and a row are drawn together and kept only when the match
 * is a real subset, which is what makes the fives and the odd rows the ones
 * that come up.
 *
 * The deeper patterns the master table names — the nines digit sum, the tens
 * column — are "all of them" patterns and cannot be selection tasks for the
 * same reason. They are carried as `noteFor` instead: said in the feedback for
 * whichever row is in play, so the lesson still teaches them.
 */

export type PatternRuleId = "ends_in_zero" | "ends_in_five" | "is_even" | "is_odd";

export interface PatternRule {
  id: PatternRuleId;
  /** How the prompt asks for it. */
  asks: string;
  /** True for a product that belongs in the selection. */
  holds(product: number): boolean;
}

export const PATTERN_RULES: readonly PatternRule[] = Object.freeze([
  { id: "ends_in_zero", asks: "ends in 0", holds: (n) => n % 10 === 0 },
  { id: "ends_in_five", asks: "ends in 5", holds: (n) => n % 10 === 5 },
  { id: "is_even", asks: "is an even number", holds: (n) => n % 2 === 0 },
  { id: "is_odd", asks: "is an odd number", holds: (n) => n % 2 === 1 },
]);

export const ruleById = (id: PatternRuleId): PatternRule =>
  PATTERN_RULES.find((rule) => rule.id === id)!;

/** Fewer than this and there is nothing to hunt; more and it is a chore. */
export const MIN_MATCHES = 2;
export const MAX_MATCHES = 8;

export interface PatternHunt {
  /** The row being hunted through. */
  driver: number;
  rule: PatternRule;
  /** The partners whose product satisfies the rule. */
  matches: number[];
}

export const matchesIn = (driver: number, rule: PatternRule, ceiling: number): number[] =>
  Array.from({ length: ceiling }, (_, i) => i + 1).filter((partner) => rule.holds(driver * partner));

export function satisfiesHunt(hunt: PatternHunt, ceiling: number): boolean {
  const found = matchesIn(hunt.driver, hunt.rule, ceiling);
  if (found.length !== hunt.matches.length) return false;
  if (found.some((partner, i) => partner !== hunt.matches[i])) return false;
  // A proper subset, and one a child can finish.
  return found.length >= MIN_MATCHES && found.length <= MAX_MATCHES && found.length < ceiling;
}

/**
 * A row and a rule that make a real hunt.
 *
 * Bounded search, then a deterministic scan, then a throw — the discipline
 * every generator in this skill follows. A ceiling that holds no legal pair is
 * an authoring error, not a constraint to relax.
 */
export function drawPatternHunt(ceiling: number, drivers?: number[]): PatternHunt {
  const rows = drivers ?? Array.from({ length: ceiling - 1 }, (_, i) => i + 2);
  for (let i = 0; i < 200; i += 1) {
    const driver = rows[randInt(0, rows.length - 1)];
    const rule = PATTERN_RULES[randInt(0, PATTERN_RULES.length - 1)];
    const hunt = { driver, rule, matches: matchesIn(driver, rule, ceiling) };
    if (satisfiesHunt(hunt, ceiling)) return hunt;
  }
  for (const driver of rows) {
    for (const rule of PATTERN_RULES) {
      const hunt = { driver, rule, matches: matchesIn(driver, rule, ceiling) };
      if (satisfiesHunt(hunt, ceiling)) return hunt;
    }
  }
  throw new Error(`tablePatterns: no pattern hunt fits a chart to ${ceiling} over rows ${rows.join(",")}`);
}

/**
 * The thing worth noticing about this row, beyond the cells just tapped.
 *
 * Said whether the child was right or wrong: the point of level 21 is the
 * pattern, and a round that only ever says "correct" has taught tapping.
 */
export function noteFor(driver: number): string | undefined {
  if (driver === 5) return "Every answer in the fives ends in 0 or 5.";
  if (driver === 9) return "In the nines the digits add up to 9 — 27, 36, 45 — right up to 90.";
  if (driver === 10) return "The tens are the other number with its digits moved up one place.";
  if (driver === 11) return "The elevens repeat the digit, as far as 9 × 11.";
  if (driver % 2 === 0) return `Every answer in the ${driver}s is even, because ${driver} is.`;
  return undefined;
}

/** Four squares from the diagonal, for a round that should not repeat itself. */
export const squaresUpTo = (ceiling: number): number[] =>
  shuffle(Array.from({ length: ceiling - 1 }, (_, i) => i + 2));
