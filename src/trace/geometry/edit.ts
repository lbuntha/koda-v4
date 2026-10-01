/**
 * The Studio's stroke tools as pure functions: each takes a stroke and returns
 * a new one. The editor only calls these; nothing here knows about the screen.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §1.4.
 */

import { splitCubic, strokePolyline, strokeSegments } from "./bezier";
import { fitNodes } from "./fit";
import type { Handle, NodeType, Point, Stroke, TraceNode } from "./types";
import { add, clamp, dist, len, normal, normalize, scale, sub } from "./vec";

const CANVAS = 1000;

const cloneNode = (n: TraceNode): TraceNode => ({
  ...n,
  in: n.in ? { ...n.in } : undefined,
  out: n.out ? { ...n.out } : undefined,
});
const withNodes = (stroke: Stroke, nodes: TraceNode[]): Stroke => ({ ...stroke, nodes });
const segmentCount = (s: Stroke) => (s.closed ? s.nodes.length : s.nodes.length - 1);
const next = (s: Stroke, i: number) => (i + 1) % s.nodes.length;
const toHandle = (p: Point): Handle => ({ dx: p.x, dy: p.y });
const fromHandle = (h: Handle | undefined): Point => (h ? { x: h.dx, y: h.dy } : { x: 0, y: 0 });

/** Move a node; its handles travel with it. Kept inside the canvas. */
export function moveNode(stroke: Stroke, i: number, to: Point): Stroke {
  const nodes = stroke.nodes.map(cloneNode);
  nodes[i].x = clamp(to.x, 0, CANVAS);
  nodes[i].y = clamp(to.y, 0, CANVAS);
  return withNodes(stroke, nodes);
}

/**
 * Bend segment `i` (node i → node i+1) into a curve bowing "up" or "down"
 * relative to its direction; call again to bend further.
 */
export function bendSegment(stroke: Stroke, i: number, direction: "up" | "down", amount = 0.2): Stroke {
  if (i < 0 || i >= segmentCount(stroke)) return stroke;
  const nodes = stroke.nodes.map(cloneNode);
  const a = nodes[i];
  const b = nodes[next(stroke, i)];
  const chord = sub(b, a);
  const l = len(chord);
  if (l === 0) return stroke;
  const push = scale(normal(chord), (direction === "up" ? 1 : -1) * amount * l);
  const out = add(fromHandle(a.out ?? toHandle(scale(chord, 1 / 3))), push);
  const inn = add(fromHandle(b.in ?? toHandle(scale(chord, -1 / 3))), push);
  a.out = toHandle(out);
  b.in = toHandle(inn);
  return withNodes(stroke, nodes);
}

/** Remove the handles of segment `i`, or of every segment when `i` is omitted. */
export function straighten(stroke: Stroke, i?: number): Stroke {
  const nodes = stroke.nodes.map(cloneNode);
  if (i === undefined) {
    for (const n of nodes) {
      n.in = undefined;
      n.out = undefined;
      n.type = "corner";
    }
    return withNodes(stroke, nodes);
  }
  if (i < 0 || i >= segmentCount(stroke)) return stroke;
  nodes[i].out = undefined;
  nodes[next(stroke, i)].in = undefined;
  return withNodes(stroke, nodes);
}

function neighbours(stroke: Stroke, i: number): [TraceNode | undefined, TraceNode | undefined] {
  const n = stroke.nodes.length;
  const prev = i > 0 ? stroke.nodes[i - 1] : stroke.closed ? stroke.nodes[n - 1] : undefined;
  const nxt = i < n - 1 ? stroke.nodes[i + 1] : stroke.closed ? stroke.nodes[0] : undefined;
  return [prev, nxt];
}

/**
 * Change how the path passes through node `i`:
 * corner — handles independent; smooth — handles in one line, lengths kept;
 * symmetric — in one line and equal. A node with no handles gets them from
 * its neighbours (a Catmull-Rom tangent), so blending a sharp polyline rounds it.
 */
export function setNodeType(stroke: Stroke, i: number, type: NodeType): Stroke {
  const nodes = stroke.nodes.map(cloneNode);
  const node = nodes[i];
  node.type = type;
  if (type === "corner") return withNodes(stroke, nodes);

  const [prev, nxt] = neighbours(stroke, i);
  if (!prev || !nxt) {
    // An end node has only one handle; nothing to line up.
    return withNodes(stroke, nodes);
  }
  const lenIn = node.in ? len(fromHandle(node.in)) : dist(node, prev) / 3;
  const lenOut = node.out ? len(fromHandle(node.out)) : dist(node, nxt) / 3;
  // Direction: the average of the existing handles if any, else the neighbour chord.
  let direction = sub(fromHandle(node.out), fromHandle(node.in));
  if (len(direction) < 1e-6) direction = sub(nxt, prev);
  const unit = normalize(direction);
  const outLength = type === "symmetric" ? (lenIn + lenOut) / 2 : lenOut;
  const inLength = type === "symmetric" ? (lenIn + lenOut) / 2 : lenIn;
  node.out = toHandle(scale(unit, outLength));
  node.in = toHandle(scale(unit, -inLength));
  return withNodes(stroke, nodes);
}

/** Every inner node smooth — the one-click fix for a wobbly fitted stroke. */
export function blendAll(stroke: Stroke): Stroke {
  let out = stroke;
  for (let i = 0; i < stroke.nodes.length; i++) {
    const [prev, nxt] = neighbours(stroke, i);
    if (prev && nxt) out = setNodeType(out, i, "smooth");
  }
  return out;
}

/** Swap direction: the same shape, drawn the other way. */
export function reverseStroke(stroke: Stroke): Stroke {
  const nodes = stroke.nodes
    .map(cloneNode)
    .reverse()
    .map((n) => ({ ...n, in: n.out, out: n.in }));
  return withNodes(stroke, nodes);
}

/** Mirror across the canvas centre line (x = 500 or y = 500). */
export function mirrorStroke(stroke: Stroke, axis: "horizontal" | "vertical"): Stroke {
  const flip = (h: Handle | undefined) =>
    h ? (axis === "horizontal" ? { dx: -h.dx, dy: h.dy } : { dx: h.dx, dy: -h.dy }) : undefined;
  const nodes = stroke.nodes.map((n) => ({
    ...n,
    x: axis === "horizontal" ? CANVAS - n.x : n.x,
    y: axis === "vertical" ? CANVAS - n.y : n.y,
    in: flip(n.in),
    out: flip(n.out),
  }));
  return withNodes(stroke, nodes);
}

/** Split segment `i` at `t` (Add Points) — the drawn shape does not change. */
export function splitSegment(stroke: Stroke, i: number, t = 0.5): Stroke {
  if (i < 0 || i >= segmentCount(stroke)) return stroke;
  const segment = strokeSegments(stroke)[i];
  const [left, right] = splitCubic(segment, t);
  const nodes = stroke.nodes.map(cloneNode);
  const a = nodes[i];
  const b = nodes[next(stroke, i)];
  const curved = Boolean(a.out || b.in);
  const mid: TraceNode = { x: left[3].x, y: left[3].y, type: curved ? "smooth" : "corner" };
  if (curved) {
    a.out = toHandle(sub(left[1], left[0]));
    mid.in = toHandle(sub(left[2], left[3]));
    mid.out = toHandle(sub(right[1], right[0]));
    b.in = toHandle(sub(right[2], right[3]));
  }
  nodes.splice(i + 1, 0, mid);
  return withNodes(stroke, nodes);
}

/** Add a node at the end (Add Points in empty space). */
export function extendStroke(stroke: Stroke, to: Point): Stroke {
  return withNodes(stroke, [...stroke.nodes.map(cloneNode), { x: clamp(to.x, 0, CANVAS), y: clamp(to.y, 0, CANVAS), type: "corner" }]);
}

/** Remove node `i` (a stroke keeps at least two). */
export function deleteNode(stroke: Stroke, i: number): Stroke {
  if (stroke.nodes.length <= 2) return stroke;
  return withNodes(
    stroke,
    stroke.nodes.filter((_, k) => k !== i).map(cloneNode),
  );
}

/** Fewer nodes, same shape within `tolerance` units — re-fitted from the drawn path. */
export function simplifyStroke(stroke: Stroke, tolerance = 3): Stroke {
  if (stroke.nodes.length <= 2 || stroke.closed) return stroke;
  const nodes = fitNodes(strokePolyline(stroke, 0.1), tolerance);
  return nodes.length >= 2 && nodes.length < stroke.nodes.length ? withNodes(stroke, nodes) : stroke;
}

/** Connect to Prev: this stroke starts where `prev` ends, and carries on from it. */
export function connectToPrevious(stroke: Stroke, prev: Stroke): Stroke {
  const end = prev.closed ? prev.nodes[0] : prev.nodes[prev.nodes.length - 1];
  const moved = moveNode(stroke, 0, end);
  return { ...moved, join: "continue" };
}

/** Connect to Next: this stroke ends where `nextStroke` starts. */
export function connectToNext(stroke: Stroke, nextStroke: Stroke): Stroke {
  return moveNode(stroke, stroke.nodes.length - 1, nextStroke.nodes[0]);
}

/** Resize every node and handle about a centre point. */
export function scaleStroke(stroke: Stroke, k: number, about: Point = { x: 500, y: 500 }): Stroke {
  const nodes = stroke.nodes.map((n) => ({
    ...n,
    x: about.x + (n.x - about.x) * k,
    y: about.y + (n.y - about.y) * k,
    in: n.in ? { dx: n.in.dx * k, dy: n.in.dy * k } : undefined,
    out: n.out ? { dx: n.out.dx * k, dy: n.out.dy * k } : undefined,
  }));
  return withNodes(stroke, nodes);
}

/* ------------------------------------------------ resize and fit */

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The drawn extent of a stroke (curves included, not just its points). */
export function strokeBox(stroke: Stroke): Box {
  const pts = strokePolyline(stroke, 0.5);
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

/** Scale by sx, sy about `about`, then move by dx, dy. Handles scale with the shape. */
export function transformStroke(stroke: Stroke, sx: number, sy: number, about: Point, dx = 0, dy = 0): Stroke {
  const nodes = stroke.nodes.map((n) => ({
    ...n,
    x: about.x + (n.x - about.x) * sx + dx,
    y: about.y + (n.y - about.y) * sy + dy,
    in: n.in ? { dx: n.in.dx * sx, dy: n.in.dy * sy } : undefined,
    out: n.out ? { dx: n.out.dx * sx, dy: n.out.dy * sy } : undefined,
  }));
  return withNodes(stroke, nodes);
}

export type FitHow = "inside" | "stretch" | "width" | "height" | "center";

/**
 * Resize and place `stroke` to match the box of another one.
 * inside — as large as fits, shape kept, centred; stretch — exactly the box;
 * width / height — same width (or height), shape kept, centred; center — just moved.
 */
export function fitStroke(stroke: Stroke, target: Box, how: FitHow): Stroke {
  const b = strokeBox(stroke);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const tw = target.maxX - target.minX;
  const th = target.maxY - target.minY;
  const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const tc = { x: (target.minX + target.maxX) / 2, y: (target.minY + target.maxY) / 2 };
  const ratio = (to: number, from: number) => (from < 1 ? 1 : to / from);
  let sx = 1;
  let sy = 1;
  if (how === "stretch") {
    sx = ratio(tw, w);
    sy = ratio(th, h);
  } else if (how === "inside") {
    // A flat stroke (a line) fits by its long side.
    const k = Math.min(w < 1 ? Infinity : tw / w, h < 1 ? Infinity : th / h);
    sx = sy = Number.isFinite(k) ? k : 1;
  } else if (how === "width") {
    sx = sy = ratio(tw, w);
  } else if (how === "height") {
    sx = sy = ratio(th, h);
  }
  return transformStroke(stroke, sx, sy, c, tc.x - c.x, tc.y - c.y);
}
