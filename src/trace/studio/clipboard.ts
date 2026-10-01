/**
 * The Studio's stroke clipboard. Kept on the device (not only in memory) so
 * strokes copied from one item can be pasted into another — reuse ក's
 * strokes to start a letter that shares its shape.
 */

import type { Stroke } from "../geometry/types";

const KEY = "koda_trace_clipboard_v1";
let memory: Stroke[] = [];

export const StrokeClipboard = {
  copy(strokes: Stroke[]) {
    memory = structuredClone(strokes);
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
    } catch {
      /* the in-memory copy still works on this page */
    }
  },
  read(): Stroke[] {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) return parsed as Stroke[];
    } catch {
      /* fall back to memory */
    }
    return memory;
  },
};

/**
 * Strokes ready to add to `existing`: fresh ids, and nudged down-right when an
 * identical stroke is already there (pasting into the same item), so the copy
 * is visible instead of hiding exactly on top.
 */
export function pasteStrokes(copied: Stroke[], existing: Stroke[], newId: () => string): Stroke[] {
  const same = copied.some((c) => existing.some((e) => JSON.stringify(e.nodes) === JSON.stringify(c.nodes)));
  const d = same ? 30 : 0;
  return copied.map((s, i) => ({
    ...structuredClone(s),
    id: newId(),
    join: i === 0 ? "lift" : s.join,
    nodes: s.nodes.map((n) => ({ ...n, x: Math.min(1000, n.x + d), y: Math.min(1000, n.y + d) })),
  }));
}
