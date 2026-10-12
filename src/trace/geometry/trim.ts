/**
 * Cut strokes at the page's edge. An author may draw past the page (half an
 * apple at the edge of a picture); a child can only trace what is on it. Each
 * piece of a stroke that lies on the page becomes a stroke of its own, refitted
 * to smooth points; what lies off the page is dropped.
 */

import { strokePolyline } from "./bezier";
import { fitNodes } from "./fit";
import { polylineLength } from "./polyline";
import type { Point, Stroke } from "./types";

const PAGE = 1000;
/** A piece shorter than this along the edge is a sliver, not a stroke. */
const MIN_PIECE = 20;

const onPage = (p: Point) => p.x >= 0 && p.x <= PAGE && p.y >= 0 && p.y <= PAGE;

/** Does any part of the stroke lie off the page? */
export function leavesPage(stroke: Pick<Stroke, "nodes" | "closed">): boolean {
  return strokePolyline(stroke).some((p) => !onPage(p));
}

/** The part of segment a→b on the page, as [t0, t1] along it (Liang–Barsky), or null. */
function clip(a: Point, b: Point): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  const edges: [number, number][] = [
    [-d.x, a.x],
    [d.x, PAGE - a.x],
    [-d.y, a.y],
    [d.y, PAGE - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** The runs of a polyline that lie on the page. A closed loop's runs join across its start. */
export function pageRuns(points: Point[], closed: boolean): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] | null = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const part = clip(a, b);
    if (!part) {
      if (run) runs.push(run);
      run = null;
      continue;
    }
    const [t0, t1] = part;
    const from = lerp(a, b, t0);
    const to = lerp(a, b, t1);
    if (!run || t0 > 0) {
      if (run) runs.push(run);
      run = [from];
    }
    run.push(to);
    if (t1 < 1) {
      runs.push(run);
      run = null;
    }
  }
  if (run) runs.push(run);
  // A loop that starts on the page: its last run carries on into its first.
  if (closed && runs.length > 1 && onPage(points[0])) {
    const last = runs.pop()!;
    runs[0] = [...last, ...runs[0].slice(1)];
  }
  return runs;
}

/**
 * Every stroke cut to the page, in writing order. A stroke wholly on the page
 * is kept as it is; one wholly off it is dropped; the rest become their pieces
 * (open lines, so no longer solid). The first piece keeps the stroke's id, part
 * and join; later pieces lift the pen.
 */
export function trimToPage(strokes: Stroke[], newId: () => string): Stroke[] {
  return strokes.flatMap((s) => {
    if (s.shape === "dot" || s.nodes.length === 1) return s.nodes[0] && onPage(s.nodes[0]) ? [s] : [];
    if (!leavesPage(s)) return [s];
    const runs = pageRuns(strokePolyline(s), s.closed).filter((r) => polylineLength(r) >= MIN_PIECE);
    return runs.map((run, k): Stroke => {
      const { fill: _f, badge: _b, part, ...rest } = s;
      return {
        ...rest,
        ...(k === 0 && part ? { part } : {}),
        id: k === 0 ? s.id : newId(),
        shape: "free",
        nodes: fitNodes(run, 2),
        closed: false,
        join: k === 0 ? s.join : "lift",
        checkpoints: [],
      };
    });
  });
}
