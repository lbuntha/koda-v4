/**
 * The rules of a trace, with no screen attached.
 *
 * A trace is the ordered list of tiles a child has chosen. Everything the ring
 * does with a finger, a tap or a key reduces to a handful of moves on that list,
 * and the moves are simple enough to state exactly — which is why they are here
 * and not inside a pointer handler:
 *
 *  - Dragging onto an unused tile adds it.
 *  - Dragging back onto the *previous* tile takes the last one off, the way a
 *    string unwinds. Any other used tile is ignored, so a wobble cannot undo
 *    three letters.
 *  - Tapping the last tile takes it off; tapping any other used tile does nothing.
 *
 * A trace holds tile *indices*, not letters: a word with two Es has two tiles
 * that look the same and are not.
 */

export interface Pt {
  x: number;
  y: number;
}

/** The tile nearest `p` and within `radius` of it, or null. Nearest, not first. */
export function hitTile(centres: readonly Pt[], p: Pt, radius: number): number | null {
  let best: number | null = null;
  let bestD = radius;
  centres.forEach((c, i) => {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** One step of a drag: the pointer is over `hit` (or over nothing). */
export function dragStep(picked: readonly number[], hit: number | null): number[] {
  if (hit === null) return [...picked];
  const last = picked[picked.length - 1];
  if (hit === last) return [...picked];
  if (picked.length >= 2 && hit === picked[picked.length - 2]) return picked.slice(0, -1);
  if (picked.includes(hit)) return [...picked];
  return [...picked, hit];
}

/** A tap or a key on tile `i`. */
export function tapStep(picked: readonly number[], i: number): number[] {
  if (picked[picked.length - 1] === i) return picked.slice(0, -1);
  if (picked.includes(i)) return [...picked];
  return [...picked, i];
}

export const backspace = (picked: readonly number[]): number[] => picked.slice(0, -1);

/** The labels of the chosen tiles, in the order chosen. */
export const labelsOf = (tiles: ReadonlyArray<{ label: string }>, picked: readonly number[]): string[] =>
  picked.map((i) => tiles[i]?.label ?? "");

/**
 * What lifting the finger does.
 *
 *  - Fewer than `minTiles` chosen: the trace is dropped and nothing is asked.
 *    A child who brushes the ring by accident has not made a mistake.
 *  - Otherwise it is submitted.
 */
export const releaseAction = (picked: readonly number[], minTiles: number): "submit" | "drop" =>
  picked.length >= Math.max(1, minTiles) ? "submit" : "drop";

/** After a tap or a key: should a trace this long submit itself? */
export const autoSubmits = (picked: readonly number[], autoSubmitAt: number | undefined): boolean =>
  autoSubmitAt !== undefined && autoSubmitAt > 0 && picked.length === autoSubmitAt;
