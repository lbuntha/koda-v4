/**
 * Checkpoints — points the ink must pass through, in order. Distance alone
 * lets half a loop or the straight part of a hook pass; checkpoints don't.
 *
 * Auto-placed at the start, the end, every inner corner node, every sharp
 * bend, and never more than 20% of the length apart. The admin can pin extra
 * ones (the curl of a hook) — a pinned checkpoint always survives.
 */

import { strokePolyline } from "./bezier";
import { nearest, pointAt, track } from "./polyline";
import type { Checkpoint, Stroke } from "./types";

const MAX_GAP = 0.2;
const MERGE = 0.05;
/** A bend sharper than this (radians of turn over the window) is a checkpoint. */
const BEND = (35 * Math.PI) / 180;
const WINDOW = 24;

export function autoCheckpoints(stroke: Stroke): number[] {
  if (stroke.nodes.length < 2) return [0];
  const t = track(strokePolyline(stroke, 0.25));
  if (t.length === 0) return [0];

  const found: number[] = [0, 1];

  // Inner corner nodes.
  stroke.nodes.forEach((node, i) => {
    const inner = stroke.closed || (i > 0 && i < stroke.nodes.length - 1);
    if (inner && node.type === "corner" && i > 0) found.push(nearest(t, node).s / t.length);
  });

  // Sharp bends: turning angle over a window either side, local maxima only.
  const turn: number[] = [];
  const at = (s: number) => pointAt(t, s);
  const samples = Math.max(2, Math.round(t.length / 8));
  for (let k = 0; k <= samples; k++) {
    const s = (t.length * k) / samples;
    if (s < WINDOW || s > t.length - WINDOW) {
      turn.push(0);
      continue;
    }
    const a = at(s - WINDOW);
    const b = at(s);
    const c = at(s + WINDOW);
    const h1 = Math.atan2(b.y - a.y, b.x - a.x);
    const h2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(h2 - h1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    turn.push(d);
  }
  for (let k = 1; k < turn.length - 1; k++) {
    if (turn[k] >= BEND && turn[k] >= turn[k - 1] && turn[k] > turn[k + 1]) found.push(k / samples);
  }

  // Fill gaps.
  const sorted = dedupe(found);
  const filled: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    filled.push(sorted[i]);
    const gap = (sorted[i + 1] ?? sorted[i]) - sorted[i];
    const pieces = Math.ceil(gap / MAX_GAP - 1e-9);
    for (let k = 1; k < pieces; k++) filled.push(sorted[i] + (gap * k) / pieces);
  }
  return dedupe(filled);
}

function dedupe(values: number[]): number[] {
  const sorted = [...values].map((v) => Math.min(1, Math.max(0, v))).sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] >= MERGE) out.push(v);
    else if (v === 1) out[out.length - 1] = 1; // the end always survives as exactly 1
  }
  return out;
}

/** The stroke's checkpoints: pinned ones plus fresh auto ones that aren't next to a pinned one. */
export function withCheckpoints(stroke: Stroke): Stroke {
  const pinned = stroke.checkpoints.filter((c) => c.pinned);
  const auto = autoCheckpoints(stroke).filter((t) => pinned.every((p) => Math.abs(p.t - t) >= MERGE || t === 0 || t === 1));
  const checkpoints: Checkpoint[] = [...pinned, ...auto.map((t) => ({ t, pinned: false }))].sort((a, b) => a.t - b.t);
  return { ...stroke, checkpoints };
}

