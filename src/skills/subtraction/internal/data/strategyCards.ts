import { crossesBoundary, digitsOf, isRegrouping, type Difference } from "./subtractionNumbers";
import { ts } from "../i18n";

/**
 * The strategies this skill has actually taught, as choosable cards.
 *
 * Every id names a technique from the master table, so a child choosing one is
 * choosing something they have been shown rather than a word.
 */
export type StrategyId =
  | "count_back"
  | "count_up"
  | "bridge_ten"
  | "constant_difference"
  | "compensate"
  | "place_value_jumps"
  | "written_column";

export interface StrategyCard {
  id: StrategyId;
  readonly name: string;
  /** What the child would actually do, in one line. */
  readonly how: string;
  /** Roughly how many moves it takes, for the comparison step. */
  steps: (value: Difference) => number;
}

/** Name and one-line method come from the catalog (`strategy.<id>`). */
function card(id: StrategyId, steps: StrategyCard["steps"]): StrategyCard {
  return {
    id,
    get name() {
      return ts(`strategy.${id}.name`);
    },
    get how() {
      return ts(`strategy.${id}.how`);
    },
    steps,
  };
}

export const STRATEGY_CARDS: readonly StrategyCard[] = [
  card("count_back", (v) => v.subtrahend),
  card("count_up", (v) => v.difference),
  card("bridge_ten", () => 2),
  card("constant_difference", () => 2),
  card("compensate", () => 2),
  card("place_value_jumps", () => 2),
  card("written_column", (v) => (isRegrouping(v.minuend, v.subtrahend) ? 3 : 2)),
] as const;

export const cardFor = (id: StrategyId): StrategyCard =>
  STRATEGY_CARDS.find((card) => card.id === id)!;

/**
 * Every strategy that genuinely fits this problem.
 *
 * Fit is decided from the numbers, never from a hand-written list, so a lesson
 * cannot drift away from what the numbers actually reward. The rule that
 * matters most is the one §12 warns about: a small difference invites counting
 * up, and a small subtrahend invites counting back, and those two are rarely
 * true of the same question.
 */
export function strategiesFor(value: Difference): StrategyId[] {
  const fits: StrategyId[] = [];
  const b = digitsOf(value.subtrahend);

  if (value.subtrahend <= 3) fits.push("count_back");
  if (value.difference <= 5) fits.push("count_up");
  if (value.minuend < 100 && crossesBoundary(value.minuend, value.subtrahend, 10) && value.subtrahend < 10) {
    fits.push("bridge_ten");
  }
  if (b.ones >= 8) { fits.push("compensate"); fits.push("constant_difference"); }
  if (value.minuend >= 20 && value.subtrahend >= 10 && !isRegrouping(value.minuend, value.subtrahend)) {
    fits.push("place_value_jumps");
  }
  // Columns always work. They are last because "it always works" is a reason to
  // keep a method, not a reason to reach for it before looking at the numbers.
  fits.push("written_column");
  return fits;
}

/** The two fitting strategies worth comparing: the fewest steps, and columns. */
export const comparisonPair = (value: Difference, fits: StrategyId[]): [StrategyCard, StrategyCard] => {
  const ranked = [...fits].map(cardFor).sort((a, b) => a.steps(value) - b.steps(value));
  const cheapest = ranked[0];
  const other = ranked.find((card) => card.id !== cheapest.id) ?? cardFor("written_column");
  return [cheapest, other];
};
