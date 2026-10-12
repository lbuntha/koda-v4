/**
 * Layers: which stroke sits in front of which in the picture. Writing order
 * says what the child draws first; the layer says what covers what — a wheel
 * drawn before the body can still sit in front of it. A stroke without a
 * layer sits at its writing place, so items made before layers look the same.
 */

import type { Stroke } from "./types";

export type Restack = "front" | "back" | "forward" | "backward";

const depth = (s: Pick<Stroke, "layer">, i: number) => s.layer ?? i;

/** Stroke indexes from the back of the picture to the front. Ties keep writing order. */
export function stackOrder(strokes: Pick<Stroke, "layer">[]): number[] {
  return strokes.map((_, i) => i).sort((a, b) => depth(strokes[a], a) - depth(strokes[b], b) || a - b);
}

/** A closed shape can be solid; an open line or a dot has no inside to fill. */
export const canFill = (s: Pick<Stroke, "closed" | "shape" | "nodes">) => s.closed && s.shape !== "dot" && s.nodes.length > 1;

/** Solid on the slate: a closed shape set to hide what lies behind it. */
export const isSolid = (s: Pick<Stroke, "closed" | "shape" | "nodes" | "fill">) => s.fill === "paper" && canFill(s);

/**
 * Move the picked strokes to the front or back, or one step forward or
 * backward (past the next stroke that is not picked). Picked strokes keep
 * their order among themselves. Every stroke gets its new layer, 0…n-1.
 */
export function restack(strokes: Stroke[], picked: number[], how: Restack): Stroke[] {
  const pick = new Set(picked.filter((i) => i >= 0 && i < strokes.length));
  if (pick.size === 0) return strokes;
  const order = stackOrder(strokes);
  let next: number[];
  if (how === "front" || how === "back") {
    const moved = order.filter((i) => pick.has(i));
    const rest = order.filter((i) => !pick.has(i));
    next = how === "front" ? [...rest, ...moved] : [...moved, ...rest];
  } else {
    next = [...order];
    // Walk toward the move so a block of picked strokes travels together.
    const forward = how === "forward";
    const positions = next.map((_, k) => k);
    if (forward) positions.reverse();
    for (const k of positions) {
      if (!pick.has(next[k])) continue;
      const j = forward ? k + 1 : k - 1;
      if (j < 0 || j >= next.length || pick.has(next[j])) continue;
      [next[k], next[j]] = [next[j], next[k]];
    }
  }
  const place = new Map(next.map((i, k) => [i, k]));
  return strokes.map((s, i) => (s.layer === place.get(i) ? s : { ...s, layer: place.get(i) }));
}
