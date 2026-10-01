/**
 * Groups and multi-selection in the Studio. A group is just a shared id on
 * strokes: they select, move, resize, mirror and copy together, while each
 * keeps its own number — the child still writes them one by one, in order.
 */

import type { Box } from "../geometry/edit";
import { strokeBox, transformStroke } from "../geometry/edit";
import type { Stroke } from "../geometry/types";

/** The indexes plus every stroke that shares a group with one of them. */
export function expandGroups(strokes: Stroke[], indexes: number[]): number[] {
  const groups = new Set(indexes.map((i) => strokes[i]?.group).filter(Boolean));
  const out = new Set(indexes);
  strokes.forEach((s, i) => {
    if (s.group && groups.has(s.group)) out.add(i);
  });
  return [...out].filter((i) => i >= 0 && i < strokes.length).sort((a, b) => a - b);
}

export function groupStrokes(strokes: Stroke[], indexes: number[], id: string): Stroke[] {
  const set = new Set(indexes);
  return strokes.map((s, i) => (set.has(i) ? { ...s, group: id } : s));
}

/** Ungroup everything the selection touches (whole groups, not just the picked members). */
export function ungroupStrokes(strokes: Stroke[], indexes: number[]): Stroke[] {
  const set = new Set(expandGroups(strokes, indexes));
  return strokes.map((s, i) => (set.has(i) ? { ...s, group: undefined } : s));
}

export function selectionBox(strokes: Stroke[], indexes: number[]): Box {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const i of indexes) {
    const s = strokes[i];
    if (!s) continue;
    const sb = s.nodes.length === 1 ? { minX: s.nodes[0].x, minY: s.nodes[0].y, maxX: s.nodes[0].x, maxY: s.nodes[0].y } : strokeBox(s);
    b.minX = Math.min(b.minX, sb.minX);
    b.minY = Math.min(b.minY, sb.minY);
    b.maxX = Math.max(b.maxX, sb.maxX);
    b.maxY = Math.max(b.maxY, sb.maxY);
  }
  return b;
}

/** Mirror a selection about its own centre, so a group flips in place. */
export function mirrorSelection(strokes: Stroke[], indexes: number[], axis: "horizontal" | "vertical"): Stroke[] {
  const b = selectionBox(strokes, indexes);
  const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const set = new Set(indexes);
  return strokes.map((s, i) => (set.has(i) ? transformStroke(s, axis === "horizontal" ? -1 : 1, axis === "vertical" ? -1 : 1, c) : s));
}

/** Pasted strokes get fresh group ids, so a pasted group is its own group. */
export function remapGroups(strokes: Stroke[], newId: () => string): Stroke[] {
  const map = new Map<string, string>();
  return strokes.map((s) => {
    if (!s.group) return s;
    if (!map.has(s.group)) map.set(s.group, newId());
    return { ...s, group: map.get(s.group) };
  });
}
