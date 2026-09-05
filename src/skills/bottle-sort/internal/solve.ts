import { isPointless, legalPours, pour, signature } from "./pour";
import { isSolved, type Rack } from "./types";

/**
 * How few pours a rack can be finished in.
 *
 * Reverse-generation already guarantees a rack is solvable, so this is not a
 * safety net — it is the measure that lets a lesson say "solvable in at most
 * n" instead of hoping, and it is what a move budget is set from. It also
 * gives the deadlock check something independent to be tested against.
 */

/** Beyond this many states the answer is not worth the wait. */
export const SEARCH_BUDGET = 120_000;

export interface SolveResult {
  /** Pours in the shortest solution, or `null` if the search ran out of budget. */
  moves: number | null;
  /** States examined. Reported so a slow lesson spec is visible, not mysterious. */
  visited: number;
}

/**
 * Breadth-first, so the first solution found is the shortest.
 *
 * Bottles are interchangeable unless the lesson makes one special, and
 * `signature` collapses those orderings into a single state — without that the
 * frontier explodes on six colours and the search never returns.
 */
export function minimumPours(start: Rack): SolveResult {
  if (isSolved(start)) return { moves: 0, visited: 0 };

  const seen = new Set<string>([signature(start)]);
  let frontier: Rack[] = [start];
  let depth = 0;
  let visited = 0;

  while (frontier.length) {
    depth += 1;
    const nextFrontier: Rack[] = [];
    for (const rack of frontier) {
      for (const move of legalPours(rack)) {
        // A whole bottle tipped into an empty one is the same position wearing
        // different labels; exploring it doubles the search for nothing.
        if (isPointless(rack, move.from, move.to)) continue;
        const child = pour(rack, move.from, move.to);
        const key = signature(child);
        if (seen.has(key)) continue;
        seen.add(key);
        visited += 1;
        if (isSolved(child)) return { moves: depth, visited };
        if (visited > SEARCH_BUDGET) return { moves: null, visited };
        nextFrontier.push(child);
      }
    }
    frontier = nextFrontier;
  }
  // Unreachable for a rack dealt by reverse-generation, which is the point.
  return { moves: null, visited };
}

/** Is there any way to finish from here? */
export function isSolvable(rack: Rack): boolean {
  return minimumPours(rack).moves !== null;
}
