/**
 * What Trace pays, by the same rule as a skill round.
 *
 * A passed writing step is Trace's round: it pays once, the collection's
 * `xpPerStep` at three stars and the shared star shares below that — so a step
 * is worth what a lesson is unless the collection says otherwise. Trying again
 * on a step already passed pays nothing, which is what stops XP being farmed
 * on the easiest step.
 */

import type { ScoringConfig } from "../../lib/scoring";
import type { LadderEvent } from "./ladder";

/** Ladder events that mean a step (or a check-up) was just passed. */
const PAYS: ReadonlySet<LadderEvent> = new Set<LadderEvent>(["up", "canDo", "learned", "rechecked"]);

export function stepXp(event: LadderEvent | null, stars: number, xpPerStep: number | null | undefined, scoring: ScoringConfig): number {
  if (!event || !PAYS.has(event) || stars <= 0) return 0;
  const full = xpPerStep ?? scoring.xpPerLevel;
  const share = stars >= 3 ? 1 : stars === 2 ? scoring.twoStarShare : scoring.oneStarShare;
  return Math.round(full * share);
}
