/**
 * Part by part: a drawing built the way a how-to-draw page teaches it —
 * 1. the body, 2. the roof, 3. the wheels. A part is a run of strokes in
 * writing order; a stroke marked `part` begins the next one. Only the parts
 * up to the one being drawn are on the slate.
 */

import type { Stroke, TraceItem } from "./types";

export interface Part {
  /** 0-based. */
  index: number;
  title?: string;
  /** Indexes into the strokes in writing order, first to last. */
  strokes: number[];
}

/** The parts of strokes given in writing order. Every stroke is in exactly one. */
export function partsOf(strokes: Pick<Stroke, "part">[]): Part[] {
  const parts: Part[] = [];
  strokes.forEach((s, i) => {
    if (i === 0 || s.part) parts.push({ index: parts.length, title: s.part?.title?.trim() || undefined, strokes: [] });
    parts[parts.length - 1].strokes.push(i);
  });
  return parts;
}

/** For each stroke (writing order), the index of its part. */
export function partIndexes(strokes: Pick<Stroke, "part">[]): number[] {
  const out: number[] = [];
  let k = -1;
  strokes.forEach((s, i) => {
    if (i === 0 || s.part) k++;
    out.push(k);
  });
  return out;
}

export const isPartByPart = (item: Pick<TraceItem, "flow" | "activity">) => item.flow === "parts" && item.activity !== "color";
