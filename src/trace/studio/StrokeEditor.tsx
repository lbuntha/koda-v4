/**
 * The stroke canvas of Trace Studio: the guide underneath (a typed glyph or a
 * picture), every stroke with its badge, and the selected stroke's points
 * and handles to drag. SVG, so every point is hit-testable.
 *
 * Tools: adjust (drag points/handles, or drag a curve to bend it), add
 * (split a segment / extend), pen (freehand, fitted to curves on release),
 * pin (checkpoints), hand (pan). Zoom with the wheel + Ctrl/⌘ or a pinch;
 * hold Space to pan with any tool. Drags repaint once per frame.
 */

import { useEffect, useRef, useState } from "react";
import { badgeCenters } from "../geometry/badges";
import type { Cubic } from "../geometry/bezier";
import { evalCubic, strokePolyline, strokeSegments } from "../geometry/bezier";
import { withCheckpoints } from "../geometry/checkpoints";
import type { Box } from "../geometry/edit";
import { expandGroups, selectionBox } from "./groups";
import { extendStroke, moveNode, splitSegment, transformStroke } from "../geometry/edit";
import { fitNodes } from "../geometry/fit";
import { nearest, pointAt, polylineLength, track } from "../geometry/polyline";
import { snapPoint } from "../geometry/snap";
import type { Point, Stroke, TraceItem, TraceNode } from "../geometry/types";
import { dist, len, normalize, sub } from "../geometry/vec";
import { badge } from "../player/render";

export type EditMode = "adjust" | "add" | "pen" | "pin" | "hand";

export interface Magic {
  snap: boolean;
  autoConnect: boolean;
  gridOnly: boolean;
}

/** The visible square of the 0–1000 canvas. */
export interface View {
  x: number;
  y: number;
  size: number;
}

export const FULL_VIEW: View = { x: 0, y: 0, size: 1000 };

export function zoomView(v: View, factor: number, about: Point = { x: v.x + v.size / 2, y: v.y + v.size / 2 }): View {
  const size = Math.min(1000, Math.max(120, v.size / factor));
  const k = size / v.size;
  return clampView({ x: about.x - (about.x - v.x) * k, y: about.y - (about.y - v.y) * k, size });
}

function clampView(v: View): View {
  const m = v.size * 0.4;
  return { size: v.size, x: Math.min(1000 - v.size + m, Math.max(-m, v.x)), y: Math.min(1000 - v.size + m, Math.max(-m, v.y)) };
}

interface Props {
  item: TraceItem;
  /** Selected strokes (a group selects together). Points and handles show when exactly one is selected. */
  selection: number[];
  selectedNode: number | null;
  mode: EditMode;
  magic: Magic;
  showCheckpoints: boolean;
  /** A light design grid (every 100 units) under everything — the Studio's only, never the child's. */
  showGrid: boolean;
  view: View;
  onView(v: View): void;
  onSelect(strokes: number[], node?: number | null): void;
  /** A change is about to start (drag, click) — the Studio saves an undo point. */
  onBegin(): void;
  onChange(strokes: Stroke[]): void;
  newId(): string;
}

type Drag =
  | { kind: "node"; stroke: number; node: number }
  | { kind: "handle"; stroke: number; node: number; which: "in" | "out" }
  | { kind: "badge"; stroke: number }
  | { kind: "box"; indexes: number[]; handle: string; origs: Stroke[]; box: Box }
  | { kind: "move"; indexes: number[]; origs: Stroke[]; start: Point; begun: boolean }
  | { kind: "bend"; stroke: number; segment: number; t: number; start: Point; orig: Stroke }
  | { kind: "pen"; points: Point[] }
  | { kind: "pan"; client: Point; view: View };

const pathOf = (stroke: Stroke) => {
  const segs = strokeSegments(stroke);
  if (segs.length === 0) return "";
  const f = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  return `M ${f(segs[0][0])} ` + segs.map((c) => `C ${f(c[1])} ${f(c[2])} ${f(c[3])}`).join(" ");
};

export function gridLines(grid: TraceItem["grid"]): { x: number[]; y: number[] } {
  switch (grid) {
    case "4x3-moeys":
      return { x: [333.3, 666.7], y: [250, 500, 750] };
    case "3x3":
      return { x: [333.3, 666.7], y: [333.3, 666.7] };
    case "baseline-4-lines":
      return { x: [], y: [250, 450, 650, 850] };
    case "dots":
      return { x: [200, 400, 600, 800], y: [200, 400, 600, 800] };
    default:
      return { x: [], y: [] };
  }
}

const DESIGN = Array.from({ length: 9 }, (_, i) => (i + 1) * 100);

function gridPoints(grid: TraceItem["grid"], design: boolean): Point[] {
  // No child's grid: snap to the design grid instead.
  if (grid === "none") return design ? [0, ...DESIGN, 1000].flatMap((x) => [0, ...DESIGN, 1000].map((y) => ({ x, y }))) : [];
  const { x, y } = gridLines(grid);
  const xs = [0, ...x, 1000];
  const ys = [0, ...y, 1000];
  // Mid-points too: letters bend around the middle of a cell as often as its corners.
  const mx = xs.slice(1).map((v, i) => (v + xs[i]) / 2);
  const my = ys.slice(1).map((v, i) => (v + ys[i]) / 2);
  return [...xs, ...mx].flatMap((gx) => [...ys, ...my].map((gy) => ({ x: gx, y: gy })));
}

function nearestOnSegments(stroke: Stroke, p: Point): { segment: number; t: number; d: number } {
  let best = { segment: 0, t: 0.5, d: Infinity };
  strokeSegments(stroke).forEach((c: Cubic, i) => {
    for (let k = 1; k < 80; k++) {
      const t = k / 80;
      const d = dist(evalCubic(c, t), p);
      if (d < best.d) best = { segment: i, t, d };
    }
  });
  return best;
}

/** Keep a smooth point smooth: the other handle turns to stay in line (keeping its length). */
function realign(n: TraceNode, moved: "in" | "out"): TraceNode {
  const other = moved === "in" ? "out" : "in";
  const h = n[moved];
  if (n.type === "corner" || !h || !n[other]) return n;
  const unit = normalize({ x: -h.dx, y: -h.dy });
  const l = n.type === "symmetric" ? len({ x: h.dx, y: h.dy }) : len({ x: n[other]!.dx, y: n[other]!.dy });
  return { ...n, [other]: { dx: unit.x * l, dy: unit.y * l } };
}

/**
 * Drag a curve at `t` so that point follows the pointer exactly. The handles
 * move by v·(1−t) and v·t (the nearer end's handle moves more), with v chosen
 * so B(t) moves by `delta`: 3t(1−t)·((1−t)² + t²)·v = delta.
 */
function bendThrough(orig: Stroke, segment: number, t: number, delta: Point): Stroke {
  const n = orig.nodes.length;
  const ai = segment;
  const bi = (segment + 1) % n;
  const a = orig.nodes[ai];
  const b = orig.nodes[bi];
  const chord = sub(b, a);
  const k = 1 / (3 * t * (1 - t) * ((1 - t) ** 2 + t ** 2));
  const v = { x: delta.x * k, y: delta.y * k };
  const out = a.out ?? { dx: chord.x / 3, dy: chord.y / 3 };
  const inn = b.in ?? { dx: -chord.x / 3, dy: -chord.y / 3 };
  const nodes = orig.nodes.map((x) => ({ ...x }));
  nodes[ai] = realign({ ...a, out: { dx: out.dx + v.x * (1 - t), dy: out.dy + v.y * (1 - t) } }, "out");
  nodes[bi] = realign({ ...b, in: { dx: inn.dx + v.x * t, dy: inn.dy + v.y * t } }, "in");
  return { ...orig, nodes };
}

/** A straight segment gets handles at a third of its length, so a drag can bend it without the grabbed point sliding. */
function withHandles(stroke: Stroke, segment: number): Stroke {
  const n = stroke.nodes.length;
  const ai = segment;
  const bi = (segment + 1) % n;
  const a = stroke.nodes[ai];
  const b = stroke.nodes[bi];
  if (a.out && b.in) return stroke;
  const chord = sub(b, a);
  const nodes = stroke.nodes.map((x) => ({ ...x }));
  nodes[ai] = { ...a, out: a.out ?? { dx: chord.x / 3, dy: chord.y / 3 } };
  nodes[bi] = { ...b, in: b.in ?? { dx: -chord.x / 3, dy: -chord.y / 3 } };
  return { ...stroke, nodes };
}

export { bendThrough, withHandles };

export function StrokeEditor({ item, selection, selectedNode, mode, magic, showCheckpoints, showGrid, view, onView, onSelect, onBegin, onChange, newId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number>(0);
  const pending = useRef<Stroke[] | null>(null);
  const [pen, setPen] = useState<Point[] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [space, setSpace] = useState(false);
  const strokes = item.strokes;
  const selected = selection.length === 1 ? selection[0] : null;
  const sel = selected !== null ? strokes[selected] : undefined;
  const k = view.size / 1000; // keeps handles the same size on screen at any zoom
  const panning = mode === "hand" || space;

  // Space = pan while held.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el?.tagName)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpace(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Wheel: Ctrl/⌘ (and trackpad pinch) zooms about the pointer; when zoomed in, plain wheel pans.
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        onView(zoomView(v, Math.exp(-e.deltaY * 0.01), toUnitsRaw(e)));
      } else if (v.size < 1000) {
        e.preventDefault();
        const per = v.size / svg.clientWidth;
        onView(clampView({ ...v, x: v.x + e.deltaX * per, y: v.y + e.deltaY * per }));
      }
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [onView]); // eslint-disable-line react-hooks/exhaustive-deps

  const toUnitsRaw = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };
  const toUnits = (e: { clientX: number; clientY: number }): Point => {
    const p = toUnitsRaw(e);
    return { x: Math.min(1000, Math.max(0, p.x)), y: Math.min(1000, Math.max(0, p.y)) };
  };

  const ends = (except: number | null) =>
    strokes.flatMap((s, i) => {
      if (i === except || s.nodes.length === 0) return [];
      const a = s.nodes[0];
      const b = s.nodes[s.nodes.length - 1];
      return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
    });

  const radius = 20 * k;
  const snap = (p: Point, except: number | null, from?: Point): Point => {
    if (magic.gridOnly) return snapPoint(p, { guide: gridPoints(item.grid, showGrid) }, radius).point;
    if (!magic.snap) return p;
    return snapPoint(p, { ends: ends(except), guide: gridPoints(item.grid, showGrid), angleFrom: from }, radius).point;
  };

  /** Moving a whole stroke snaps its start point; the rest follows. */
  const snapDelta = (orig: Stroke, index: number, delta: Point): Point => {
    const start = orig.nodes[0];
    const want = { x: start.x + delta.x, y: start.y + delta.y };
    const got = snap(want, index);
    return { x: got.x - start.x, y: got.y - start.y };
  };

  /** Repaint at most once per frame while dragging. */
  const push = (next: Stroke[]) => {
    pending.current = next;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (pending.current) onChange(pending.current);
      pending.current = null;
    });
  };
  const flush = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (pending.current) onChange(pending.current);
    pending.current = null;
  };
  const current = () => pending.current ?? strokes;
  const replace = (i: number, s: Stroke) => push(current().map((x, j) => (j === i ? s : x)));
  const replaceMany = (indexes: number[], next: Stroke[]) => {
    const at = new Map(indexes.map((i, k2) => [i, next[k2]]));
    push(current().map((x, j) => at.get(j) ?? x));
  };

  /* ---------------------------------------------------- pointer */
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const target = e.target as SVGElement;
    const role = target.dataset.role;
    const si = target.dataset.stroke !== undefined ? Number(target.dataset.stroke) : null;
    const ni = target.dataset.node !== undefined ? Number(target.dataset.node) : null;

    if (panning || e.button === 1) {
      svg.setPointerCapture(e.pointerId);
      drag.current = { kind: "pan", client: { x: e.clientX, y: e.clientY }, view };
      return;
    }
    const p = toUnits(e);

    if (mode === "pen") {
      svg.setPointerCapture(e.pointerId);
      drag.current = { kind: "pen", points: [p] };
      setPen([p]);
      return;
    }

    // A stroke's number can be dragged in any tool but the pen.
    if (role === "badge" && si !== null) {
      onBegin();
      onSelect([si], null);
      svg.setPointerCapture(e.pointerId);
      drag.current = { kind: "badge", stroke: si };
      return;
    }

    if (mode === "adjust" && (role === "box" || role === "move") && selection.length > 0) {
      onBegin();
      svg.setPointerCapture(e.pointerId);
      const origs = selection.map((i) => strokes[i]);
      drag.current =
        role === "box"
          ? { kind: "box", indexes: selection, handle: target.dataset.handle!, origs, box: selectionBox(strokes, selection) }
          : { kind: "move", indexes: selection, origs, start: p, begun: true };
      return;
    }

    if (mode === "adjust") {
      if ((role === "node" || role === "handle") && si !== null && ni !== null) {
        onBegin();
        onSelect([si], ni);
        svg.setPointerCapture(e.pointerId);
        drag.current = role === "node" ? { kind: "node", stroke: si, node: ni } : { kind: "handle", stroke: si, node: ni, which: target.dataset.which as "in" | "out" };
        return;
      }
      if (role === "stroke" && si !== null) {
        const s = strokes[si];
        if (e.altKey && si === selected && s.shape !== "dot" && s.nodes.length > 1) {
          // Alt/⌥-drag the curve itself to bend it.
          const seg = nearestOnSegments(s, p).segment;
          const orig = withHandles(s, seg);
          const at = nearestOnSegments(orig, p);
          onBegin();
          svg.setPointerCapture(e.pointerId);
          drag.current = { kind: "bend", stroke: si, segment: at.segment, t: Math.min(0.85, Math.max(0.15, at.t)), start: p, orig };
          return;
        }
        const picked = expandGroups(strokes, [si]);
        if (e.shiftKey) {
          // Shift+click adds to the selection, or takes it (with its group) away.
          const has = picked.every((i) => selection.includes(i));
          return onSelect(has ? selection.filter((i) => !picked.includes(i)) : expandGroups(strokes, [...selection, ...picked]));
        }
        // Press and drag moves it (and whatever is selected with it); a click without moving only selects.
        const indexes = selection.includes(si) ? selection : picked;
        if (!selection.includes(si)) onSelect(indexes, null);
        svg.setPointerCapture(e.pointerId);
        drag.current = { kind: "move", indexes, origs: indexes.map((i) => strokes[i]), start: p, begun: false };
        return;
      }
      if (!e.shiftKey) onSelect([], null);
      return;
    }

    if (mode === "add") {
      if (role === "stroke" && si !== null && si === selected && sel && sel.shape !== "dot") {
        const at = nearestOnSegments(sel, p);
        onBegin();
        onChange(strokes.map((x, j) => (j === si ? splitSegment(sel, at.segment, at.t) : x)));
        onSelect([si], at.segment + 1);
        return;
      }
      if (role === "stroke" && si !== null) return onSelect([si], null);
      if (sel && selected !== null && !sel.closed && sel.shape !== "dot") {
        const last = sel.nodes[sel.nodes.length - 1];
        onBegin();
        onChange(strokes.map((x, j) => (j === selected ? extendStroke(sel, snap(p, selected, last)) : x)));
        onSelect([selected], sel.nodes.length);
      }
      return;
    }

    if (mode === "pin") {
      if (role === "stroke" && si !== null && sel && si === selected && sel.shape !== "dot") {
        const t = track(strokePolyline(sel));
        const at = nearest(t, p).s / Math.max(1, t.length);
        const pinned = sel.checkpoints.filter((c) => c.pinned);
        const hit = pinned.find((c) => Math.abs(c.t - at) < 0.04);
        onBegin();
        const next = hit ? pinned.filter((c) => c !== hit) : [...pinned, { t: Math.round(at * 1000) / 1000, pinned: true }];
        onChange(strokes.map((x, j) => (j === si ? { ...sel, checkpoints: next.sort((a, b) => a.t - b.t) } : x)));
        return;
      }
      if (role === "stroke" && si !== null) onSelect([si], null);
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const per = d.view.size / svgRef.current!.clientWidth;
      onView(clampView({ ...d.view, x: d.view.x - (e.clientX - d.client.x) * per, y: d.view.y - (e.clientY - d.client.y) * per }));
      return;
    }
    const p = toUnits(e);
    if (d.kind === "pen") {
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events) d.points.push(toUnits(ev));
      setPen([...d.points]);
      return;
    }
    if (d.kind === "move") {
      if (!d.begun) {
        if (dist(p, d.start) < 4 * k) return;
        d.begun = true;
        onBegin();
      }
      // The first stroke's start snaps; everything selected moves with it.
      const delta = magic.snap || magic.gridOnly ? snapDelta(d.origs[0], d.indexes[0], sub(p, d.start)) : sub(p, d.start);
      replaceMany(
        d.indexes,
        d.origs.map((o) => transformStroke(o, 1, 1, { x: 0, y: 0 }, delta.x, delta.y)),
      );
      return;
    }
    if (d.kind === "box") {
      const b = d.box;
      const w = Math.max(1, b.maxX - b.minX);
      const h = Math.max(1, b.maxY - b.minY);
      let sx = 1;
      let sy = 1;
      let ax = b.minX;
      let ay = b.minY;
      if (d.handle.includes("e")) sx = (p.x - b.minX) / w;
      if (d.handle.includes("w")) {
        sx = (b.maxX - p.x) / w;
        ax = b.maxX;
      }
      if (d.handle.includes("s")) sy = (p.y - b.minY) / h;
      if (d.handle.includes("n")) {
        sy = (b.maxY - p.y) / h;
        ay = b.maxY;
      }
      // A flat side (a straight line) has nothing to stretch on that axis.
      if (b.maxX - b.minX < 1) sx = 1;
      if (b.maxY - b.minY < 1) sy = 1;
      // Corners keep the shape with Shift.
      if (e.shiftKey && d.handle.length === 2) sx = sy = Math.max(sx, sy);
      sx = Math.max(0.05, sx);
      sy = Math.max(0.05, sy);
      replaceMany(
        d.indexes,
        d.origs.map((o) => transformStroke(o, sx, sy, { x: ax, y: ay })),
      );
      return;
    }
    const s = current()[d.stroke];
    if (!s) return;
    if (d.kind === "badge") {
      const start = s.nodes[0];
      replace(d.stroke, { ...s, badge: { dx: Math.round(p.x - start.x), dy: Math.round(p.y - start.y) } });
      return;
    }
    if (d.kind === "bend") {
      replace(d.stroke, bendThrough(d.orig, d.segment, d.t, sub(p, d.start)));
      return;
    }
    if (d.kind === "node") {
      const prev = s.nodes[d.node - 1];
      const straight = prev && !prev.out && !s.nodes[d.node].in;
      replace(d.stroke, moveNode(s, d.node, snap(p, d.stroke, straight ? prev : undefined)));
      return;
    }
    const nodes = s.nodes.map((n) => ({ ...n }));
    const n = nodes[d.node];
    nodes[d.node] = realign({ ...n, [d.which]: { dx: p.x - n.x, dy: p.y - n.y } }, d.which);
    replace(d.stroke, { ...s, nodes });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    flush();
    if (d?.kind !== "pen") return;
    setPen(null);
    const pts = d.points;
    const order = strokes.length + 1;
    let stroke: Stroke;
    if (polylineLength(pts) < 12 * k) {
      stroke = { id: newId(), order, shape: "dot", nodes: [{ ...pts[0], type: "corner" }], closed: false, join: "lift", width: 60, radius: 20, checkpoints: [] };
    } else {
      const nodes = fitNodes(pts, 6 * k);
      stroke = { id: newId(), order, shape: "free", nodes, closed: false, join: "lift", width: 60, checkpoints: [] };
      const start = nodes[0];
      const prev = strokes[strokes.length - 1];
      const prevEnd = prev && prev.nodes.length > 0 ? prev.nodes[prev.nodes.length - 1] : undefined;
      if (magic.autoConnect && prevEnd && dist(start, prevEnd) <= 45) {
        nodes[0] = { ...start, x: prevEnd.x, y: prevEnd.y };
        stroke.join = "continue";
      } else if (magic.snap || magic.gridOnly) {
        const s0 = snap(start, null);
        nodes[0] = { ...start, x: s0.x, y: s0.y };
      }
      const last = nodes.length - 1;
      if (magic.snap && !magic.gridOnly) {
        const e1 = snap(nodes[last], null);
        nodes[last] = { ...nodes[last], x: e1.x, y: e1.y };
      }
    }
    onBegin();
    onChange([...strokes, stroke]);
    onSelect([strokes.length], null);
  };

  /* ---------------------------------------------------- render */
  const { x: gx, y: gy } = gridLines(item.grid);
  const guide = item.guide;
  const cursor = drag.current?.kind === "pan" ? "grabbing" : panning ? "grab" : mode === "pen" ? "crosshair" : mode === "adjust" ? "default" : "copy";

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
      className="block aspect-square w-full touch-none select-none bg-slate-100 dark:bg-slate-800"
      style={{ cursor }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <rect width="1000" height="1000" fill="#ffffff" />
      {showGrid &&
        DESIGN.map((v) => (
          <g key={`d${v}`} pointerEvents="none">
            <line x1={v} x2={v} y1={0} y2={1000} stroke={v === 500 ? "#d9dcea" : "#eef0f6"} strokeWidth={v === 500 ? 2 : 1.5} />
            <line x1={0} x2={1000} y1={v} y2={v} stroke={v === 500 ? "#d9dcea" : "#eef0f6"} strokeWidth={v === 500 ? 2 : 1.5} />
          </g>
        ))}
      {item.grid === "dots"
        ? gx.flatMap((x) => gy.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={5} fill="#d5d8e6" />))
        : [
            ...gx.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={1000} stroke="#c9cde0" strokeWidth={2.5} strokeDasharray="10 12" />),
            ...gy.map((y) => <line key={`y${y}`} x1={0} x2={1000} y1={y} y2={y} stroke="#c9cde0" strokeWidth={2.5} strokeDasharray="10 12" />),
          ]}
      <rect width="1000" height="1000" fill="none" stroke="#dfe2ee" strokeWidth={2} />
      {guide?.image && !guide.image.hidden && <image href={guide.image.src} x={guide.image.x} y={guide.image.y} width={guide.image.w} height={guide.image.h} opacity={guide.image.opacity} preserveAspectRatio="xMidYMid meet" pointerEvents="none" />}
      {guide?.glyph && guide.glyph.text && !guide.glyph.hidden && (
        <text x={guide.glyph.x} y={guide.glyph.y} fontSize={guide.glyph.size} textAnchor="middle" fill="#e3def8" pointerEvents="none" fontFamily='"Noto Sans Khmer", "Kantumruy Pro", system-ui, sans-serif'>
          {guide.glyph.text}
        </text>
      )}
      {item.carrier && (
        <text x={item.carrier.box.x} y={item.carrier.box.y + item.carrier.box.h * 0.8} fontSize={item.carrier.box.h} fill="#d5d8e6" pointerEvents="none" fontFamily='"Noto Sans Khmer", system-ui, sans-serif'>
          {item.carrier.text}
        </text>
      )}

      {/* Strokes */}
      {strokes.map((s, i) => {
        const isSel = selection.includes(i);
        const isHover = i === hover && !isSel;
        const hitProps = {
          "data-role": "stroke",
          "data-stroke": i,
          onPointerEnter: () => setHover(i),
          onPointerLeave: () => setHover((h) => (h === i ? null : h)),
          style: { cursor: panning ? undefined : mode === "adjust" ? "move" : "pointer" },
        };
        if (s.shape === "dot" || s.nodes.length === 1) {
          const n = s.nodes[0];
          return <circle key={s.id} cx={n.x} cy={n.y} r={(s.radius ?? 20) + 8} fill={isSel ? "#5b3fd9" : isHover ? "#7c68ea" : "#a99cf0"} {...hitProps} />;
        }
        const d = pathOf(s);
        return (
          <g key={s.id}>
            <path d={d} fill="none" stroke="#8b7cf0" strokeOpacity={isSel ? 0.2 : 0.1} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            <path d={d} fill="none" stroke={isSel ? "#5b3fd9" : isHover ? "#7c68ea" : "#a99cf0"} strokeWidth={(isSel || isHover ? 8 : 6) * Math.max(0.6, k)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
            <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(24, 36 * k)} {...hitProps} />
          </g>
        );
      })}

      {/* Direction arrows on the selected stroke */}
      {sel && sel.shape !== "dot" && sel.nodes.length > 1 && (() => {
        const t = track(strokePolyline(sel));
        const marks = [];
        for (let d = 70; d < t.length - 30; d += 130) {
          const a = pointAt(t, d);
          const b = pointAt(t, d + 8);
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          marks.push(<path key={d} d="M -12 -10 L 4 0 L -12 10" transform={`translate(${a.x} ${a.y}) rotate(${ang}) scale(${Math.max(0.6, k)})`} fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />);
        }
        return <g>{marks}</g>;
      })()}

      {/* Number badges — drag one to move it; a thin line shows whose start it is */}
      {(() => {
        const centers = badgeCenters(strokes);
        return strokes.map((s, i) => {
          const n = s.nodes[0];
          if (!n) return null;
          const c = centers[i];
          const r = 22;
          const isSel = selection.includes(i);
          const draggable = mode !== "pen" && !panning;
          return (
            <g key={`b${s.id}`}>
              <line x1={n.x} y1={n.y} x2={c.x} y2={c.y} stroke={isSel ? "#5b3fd9" : "#b3a8f2"} strokeWidth={2} strokeDasharray="4 4" pointerEvents="none" />
              <circle
                cx={c.x}
                cy={c.y}
                r={r}
                fill={isSel ? "#5b3fd9" : "#b3a8f2"}
                stroke={s.badge ? "#ffffff" : "none"}
                strokeWidth={3}
                data-role="badge"
                data-stroke={i}
                pointerEvents={draggable ? "all" : "none"}
                style={{ cursor: draggable ? "move" : undefined }}
              />
              <text x={c.x} y={c.y} dy="0.36em" textAnchor="middle" fontSize={24} fontWeight={700} fill="#ffffff" pointerEvents="none" fontFamily='"Noto Sans Khmer", system-ui, sans-serif'>
                {badge(s.order, item)}
              </text>
            </g>
          );
        });
      })()}

      {/* Resize box: corners scale (Shift keeps the shape), edges stretch, the grip above moves */}
      {mode === "adjust" && !panning && (selection.length > 1 || (sel && sel.shape !== "dot" && sel.nodes.length > 1)) && (() => {
        const b = selectionBox(strokes, selection);
        const pad = 26 * k;
        const x0 = b.minX - pad;
        const y0 = b.minY - pad;
        const x1 = b.maxX + pad;
        const y1 = b.maxY + pad;
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const hs = 9 * k;
        const handles: [string, number, number, string][] = [
          ["nw", x0, y0, "nwse-resize"],
          ["n", mx, y0, "ns-resize"],
          ["ne", x1, y0, "nesw-resize"],
          ["e", x1, my, "ew-resize"],
          ["se", x1, y1, "nwse-resize"],
          ["s", mx, y1, "ns-resize"],
          ["sw", x0, y1, "nesw-resize"],
          ["w", x0, my, "ew-resize"],
        ];
        return (
          <g>
            <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="none" stroke="#8b7cf0" strokeWidth={1.5 * k} strokeDasharray={`${6 * k} ${5 * k}`} pointerEvents="none" />
            <line x1={mx} y1={y0} x2={mx} y2={y0 - 34 * k} stroke="#8b7cf0" strokeWidth={1.5 * k} pointerEvents="none" />
            <g data-role="move" data-stroke={selection[0]} style={{ cursor: "move" }}>
              <circle cx={mx} cy={y0 - 46 * k} r={13 * k} fill="#5b3fd9" data-role="move" data-stroke={selection[0]} />
              <path
                d={`M ${mx - 7 * k} ${y0 - 46 * k} H ${mx + 7 * k} M ${mx} ${y0 - 53 * k} V ${y0 - 39 * k}`}
                stroke="#ffffff"
                strokeWidth={2.5 * k}
                strokeLinecap="round"
                pointerEvents="none"
              />
            </g>
            {handles.map(([h, x, y, cursor]) => (
              <rect key={h} x={x - hs} y={y - hs} width={hs * 2} height={hs * 2} rx={2 * k} fill="#ffffff" stroke="#8b7cf0" strokeWidth={2.5 * k} data-role="box" data-stroke={selection[0]} data-handle={h} style={{ cursor }} />
            ))}
          </g>
        );
      })()}

      {/* Selected stroke: start/end, checkpoints, handles, points */}
      {sel && sel.nodes.length > 0 && (
        <g>
          <circle cx={sel.nodes[0].x} cy={sel.nodes[0].y} r={18 * k} fill="none" stroke="#10b981" strokeWidth={5 * k} strokeDasharray={`${6 * k} ${5 * k}`} pointerEvents="none" />
          {!sel.closed && sel.nodes.length > 1 && <circle cx={sel.nodes[sel.nodes.length - 1].x} cy={sel.nodes[sel.nodes.length - 1].y} r={9 * k} fill="#e0245e" pointerEvents="none" />}
          {showCheckpoints &&
            sel.shape !== "dot" &&
            (() => {
              const t = track(strokePolyline(sel));
              return withCheckpoints(sel).checkpoints.map((c, idx) => {
                const p = pointAt(t, c.t * t.length);
                return <circle key={idx} cx={p.x} cy={p.y} r={(c.pinned ? 10 : 7) * k} fill={c.pinned ? "#6d4ee8" : "#ffffff"} stroke="#6d4ee8" strokeWidth={3 * k} pointerEvents="none" />;
              });
            })()}
          {mode === "adjust" &&
            sel.nodes.map((n, idx) => (
              <g key={idx}>
                {(["in", "out"] as const).map((w) =>
                  n[w] ? (
                    <g key={w}>
                      <line x1={n.x} y1={n.y} x2={n.x + n[w]!.dx} y2={n.y + n[w]!.dy} stroke="#9b8def" strokeWidth={2 * k} pointerEvents="none" />
                      <circle cx={n.x + n[w]!.dx} cy={n.y + n[w]!.dy} r={9 * k} fill="#ffffff" stroke="#6d4ee8" strokeWidth={3 * k} data-role="handle" data-stroke={selected!} data-node={idx} data-which={w} style={{ cursor: "grab" }} />
                    </g>
                  ) : null,
                )}
              </g>
            ))}
          {sel.nodes.map((n, idx) => {
            const active = idx === selectedNode;
            const common = { "data-role": "node", "data-stroke": selected!, "data-node": idx, style: { cursor: mode === "adjust" ? "grab" : "pointer" } };
            const r = 12 * k;
            return n.type === "corner" ? (
              <rect key={idx} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} rx={3 * k} fill={active ? "#5b3fd9" : "#ffffff"} stroke="#5b3fd9" strokeWidth={3 * k} {...common} />
            ) : n.type === "symmetric" ? (
              <rect key={idx} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${n.x} ${n.y})`} fill={active ? "#5b3fd9" : "#ffffff"} stroke="#5b3fd9" strokeWidth={3 * k} {...common} />
            ) : (
              <circle key={idx} cx={n.x} cy={n.y} r={r} fill={active ? "#5b3fd9" : "#ffffff"} stroke="#5b3fd9" strokeWidth={3 * k} {...common} />
            );
          })}
        </g>
      )}

      {pen && pen.length > 1 && <polyline points={pen.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#1f2544" strokeWidth={8 * Math.max(0.6, k)} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
    </svg>
  );
}
