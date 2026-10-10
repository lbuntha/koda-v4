/**
 * Leftovers: small parts no colour step owns — the sliver between a hair line
 * and a headband, a gap a stray line cut off. They would stay white in a
 * coloured picture. Each is given to the step whose part lies nearest across
 * the line (the one it borders most), so filling the hair fills its slivers too.
 */

import type { PaintStep } from "../geometry/types";
import type { Areas } from "./areas";
import { owners } from "./areas";
import { GRID, GRID_SCALE } from "./grid";
import { insidePoints } from "./picture";

/** Largest part counted as a leftover, in cells (about 2,800 units², 2% of the page each way). */
export const LEFTOVER = 700 * GRID_SCALE * GRID_SCALE;
/** How far across a line to look for the neighbouring part, in cells (28 units). */
const REACH = 14 * GRID_SCALE;

/** Unowned parts small enough to be leftovers (specks included: they are left white too). */
export function leftovers(areas: Areas, steps: readonly PaintStep[]): number[] {
  if (steps.length === 0) return [];
  const own = owners(areas, steps);
  // A strip walled in between two close lines is a sliver however long it runs (a fold of a cape, the edge of the hair).
  return areas.sizes.flatMap((size, l) => (own[l] < 0 && (size <= LEFTOVER || areas.strips?.has(l)) ? [l] : []));
}

/** The step whose parts a leftover borders most, or -1 when it borders white parts most (or nothing is in reach). */
function neighbourStep(areas: Areas, own: Int32Array, label: number, cells: number[], seen: Int32Array, mark: number, small: Set<number>): number {
  // Walk out from the leftover through line cells only, a ring at a time.
  // `seen` is shared by every leftover: a cell is seen for this one when it holds this one's mark.
  let ring = cells;
  for (const i of ring) seen[i] = mark;
  const votes = new Map<number, number>();
  for (let d = 0; d < REACH && ring.length && votes.size === 0; d++) {
    const next: number[] = [];
    for (const i of ring) {
      const x = i % GRID;
      for (const j of [x > 0 ? i - 1 : -1, x < GRID - 1 ? i + 1 : -1, i - GRID, i + GRID]) {
        if (j < 0 || j >= seen.length || seen[j] === mark) continue;
        seen[j] = mark;
        const l = areas.labels[j];
        // Lines, and other slivers (a strip beside a strip, between close lines), are looked through to the parts behind them.
        if (l < 0 || (l !== label && small.has(l))) next.push(j);
        // Every neighbouring part votes; one no step owns votes -1, so a leftover mostly
        // beside white parts (an eye's white beside an uncoloured face) stays white.
        else if (l !== label) votes.set(own[l], (votes.get(own[l]) ?? 0) + 1);
      }
    }
    ring = next;
  }
  let best = -1;
  let most = 0;
  for (const [k, n] of votes) if (n > most) [most, best] = [n, k];
  return best; // -1 when white parts win
}

/** Steps with every leftover added to its neighbouring step; and how many were placed. */
export function fillLeftovers(areas: Areas, steps: readonly PaintStep[]): { steps: PaintStep[]; placed: number } {
  const small = leftovers(areas, steps);
  if (small.length === 0) return { steps: [...steps], placed: 0 };
  const own = owners(areas, steps);
  const cellsOf = new Map<number, number[]>(small.map((l) => [l, []]));
  for (let i = 0; i < areas.labels.length; i++) cellsOf.get(areas.labels[i])?.push(i);
  const added = steps.map(() => [] as { x: number; y: number }[]);
  const points = insidePoints(areas, small);
  let placed = 0;
  const seen = new Int32Array(GRID * GRID);
  const smallSet = new Set(small);
  for (const [n, l] of small.entries()) {
    const k = neighbourStep(areas, own, l, cellsOf.get(l)!, seen, n + 1, smallSet);
    if (k < 0) continue;
    added[k].push(points.get(l)!);
    placed++;
  }
  return { steps: steps.map((s, k) => (added[k].length ? { ...s, seeds: [...s.seeds, ...added[k]] } : s)), placed };
}
