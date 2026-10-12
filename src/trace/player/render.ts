/**
 * Drawing the slate: grid, carrier letter, ghost, path bands, arrows, badges,
 * the coach's hints and the child's ink. Plain canvas, one pass per frame.
 * Everything is in 0–1000 units; `scale` maps to device pixels.
 *
 * The slate is always a white page (like the Library reader), in both themes.
 */

import { strokePolyline } from "../geometry/bezier";
import { badgeCenters } from "../geometry/badges";
import { nearest, pointAt, track } from "../geometry/polyline";
import type { Point, TraceItem } from "../geometry/types";
import { lookOf } from "../geometry/types";
import { isSolid, stackOrder } from "../geometry/layers";
import { isPartByPart, partIndexes } from "../geometry/parts";
import type { PreparedStroke } from "../score/score";
import type { Aid } from "../progress/coach";
import type { Switches } from "./help";

export const COLORS = {
  paper: "#ffffff",
  grid: "#e2e4ee",
  carrier: "#d5d8e6",
  ghost: "#E6E0FA",
  band: "#805AD5",
  bandDone: "#bfe9d6",
  ok: "#0f9d6b",
  bad: "#e0245e",
  start: "#10b981",
  badge: "#6B46C1",
  badgeText: "#ffffff",
  ink: "#1f2544",
  tip: "#9F7AEA",
  /** The thin look's outline: the shape as a clean line, like the picture it came from. */
  outline: "#b9b3d9",
  /** The dashed look: dark dashes, like a printed worksheet. */
  dash: "#4a4f6a",
} as const;

/** The thin look, in units: outline, the current stroke's guide, a finished stroke. */
const THIN = { outline: 10, current: 24, done: 14 } as const;

const KM_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

/** A stroke badge in the item's own numerals: ១ ២ ៣ for Khmer, 1 2 3 otherwise. */
export const badge = (n: number, item: Pick<TraceItem, "script" | "numerals">) =>
  (item.numerals ?? (item.script === "khmer" ? "khmer" : "latin")) === "khmer" ? String(n).replace(/\d/g, (d) => KM_DIGITS[+d]) : String(n);

export interface SceneInk {
  points: Point[];
  state: "pending" | "ok" | "rejected";
  /** The stroke this ink settled onto (accepted): it is drawn in that stroke's layer. */
  stroke?: number;
}

export interface Scene {
  item: TraceItem;
  prepared: PreparedStroke[];
  switches: Switches;
  /** Index into `prepared` of the stroke to write next (guided); -1 when unguided. */
  current: number;
  /** Strokes already accepted this attempt. */
  done: Set<number>;
  /** Coach aids for the current stroke. */
  aids: Aid[];
  /** Band half-width, per stroke, in units. */
  radii: number[];
  ink: SceneInk[];
  /** 0 = raw ink; 0.5 = drawn ink pulled halfway to the path (big step). Scoring never sees this. */
  assist: number;
  /** A stroke to dash as dotted outline only (faded step). */
  dotted: boolean;
  /** 0–1, for pulsing things. */
  pulse: number;
  /** Highlight only this stroke, others dimmed (drill / numbers aid). */
  dimOthers: boolean;
}

function line(ctx: CanvasRenderingContext2D, points: Point[], s: number) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)));
}

/** Drop crowded points and average out the hand's wobble — for the eye only. Ends stay put. */
function soften(points: Point[]): Point[] {
  const kept: Point[] = [];
  for (const p of points) if (!kept.length || Math.hypot(p.x - kept[kept.length - 1].x, p.y - kept[kept.length - 1].y) >= 3) kept.push(p);
  const last = points[points.length - 1];
  if (kept.length > 1 && kept[kept.length - 1] !== last) kept[kept.length - 1] = last;
  let out = kept;
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const prev = out;
    out = prev.map((p, i) => (i === 0 || i === prev.length - 1 ? p : { x: (prev[i - 1].x + p.x * 2 + prev[i + 1].x) / 4, y: (prev[i - 1].y + p.y * 2 + prev[i + 1].y) / 4 }));
  }
  return out;
}

/** A curve through the points: each one bends the line toward it, midpoint to midpoint. */
function curve(ctx: CanvasRenderingContext2D, points: Point[], s: number) {
  ctx.beginPath();
  ctx.moveTo(points[0].x * s, points[0].y * s);
  for (let i = 1; i < points.length - 1; i++) {
    const m = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    ctx.quadraticCurveTo(points[i].x * s, points[i].y * s, m.x * s, m.y * s);
  }
  const end = points[points.length - 1];
  ctx.lineTo(end.x * s, end.y * s);
}

/** Ink on the slate, as thick as the stroke was designed, up to the usual pen (16, or 11 in the thin look). */
const inkWidth = (width: number, thin: boolean) => Math.min(thin ? 11 : 16, Math.max(6, width));

/** The ghost's line width for a stroke, in units: the thin outline, or three quarters of the stroke's own width. */
const ghostWidth = (thin: boolean, width: number) => (thin ? Math.min(THIN.outline, width) : width * 0.75);

/** Dashes that suit a line's width: long enough to read as dashes, never so short they look like dots. */
const dashes = (lineWidth: number, s: number) => [Math.max(18, lineWidth * 2.2) * s, Math.max(14, lineWidth * 1.6) * s];

/** Round dots (a zero-length dash with round caps), spaced so each stands apart. */
const dots = (lineWidth: number, s: number) => [0.01 * s, Math.max(10, lineWidth * 1.6) * s];

/** The dash pattern of a look: dots, dashes, or none (a solid line). */
const pattern = (look: { dashed: boolean; dotted: boolean }, lineWidth: number, s: number) => (look.dotted ? dots(lineWidth, s) : look.dashed ? dashes(lineWidth, s) : []);

/** A dot in the faint picture, in the same colour as the lines around it (the thin and dashed looks are darker than the wide one). */
function ghostDot(ctx: CanvasRenderingContext2D, at: Point, radius: number, look: { thin: boolean; dashed: boolean; dotted: boolean }, s: number, color?: string) {
  ctx.fillStyle = color ?? (look.dashed || look.dotted ? COLORS.dash : look.thin ? COLORS.outline : COLORS.ghost);
  ctx.beginPath();
  ctx.arc(at.x * s, at.y * s, Math.max(6, radius) * s, 0, Math.PI * 2);
  ctx.fill();
}

/** Paint a closed shape's inside with the paper, hiding whatever was drawn behind it. */
export function paperFill(ctx: CanvasRenderingContext2D, poly: Point[], s: number) {
  ctx.fillStyle = COLORS.paper;
  line(ctx, poly, s);
  ctx.closePath();
  ctx.fill();
}

function drawGrid(ctx: CanvasRenderingContext2D, item: TraceItem, s: number) {
  const cols = 3;
  const rows = item.grid === "4x3-moeys" ? 4 : 3;
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 2 * s;
  ctx.setLineDash([10 * s, 12 * s]);
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(((i * 1000) / cols) * s, 0);
    ctx.lineTo(((i * 1000) / cols) * s, 1000 * s);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, ((i * 1000) / rows) * s);
    ctx.lineTo(1000 * s, ((i * 1000) / rows) * s);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function drawCarrier(ctx: CanvasRenderingContext2D, item: TraceItem, s: number, highlightZone = false) {
  if (!item.carrier) return;
  const b = item.carrier.box;
  if (highlightZone && item.zone && item.zone !== "around") {
    ctx.fillStyle = "rgba(128,90,213,0.12)";
    const z = { above: [b.x, 0, b.w, b.y], below: [b.x, b.y + b.h, b.w, 1000 - b.y - b.h], left: [0, b.y, b.x, b.h], right: [b.x + b.w, b.y, 1000 - b.x - b.w, b.h] }[item.zone];
    ctx.fillRect(z[0] * s, z[1] * s, z[2] * s, z[3] * s);
  }
  ctx.fillStyle = COLORS.carrier;
  ctx.font = `${b.h * s}px "Noto Sans Khmer", "Kantumruy Pro", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(item.carrier.text, b.x * s, (b.y + b.h * 0.8) * s);
}

function chevron(ctx: CanvasRenderingContext2D, at: Point, toward: Point, size: number, s: number) {
  const a = Math.atan2(toward.y - at.y, toward.x - at.x);
  ctx.beginPath();
  ctx.moveTo((at.x + Math.cos(a + 2.5) * size) * s, (at.y + Math.sin(a + 2.5) * size) * s);
  ctx.lineTo((at.x + Math.cos(a) * size * 0.2) * s, (at.y + Math.sin(a) * size * 0.2) * s);
  ctx.lineTo((at.x + Math.cos(a - 2.5) * size) * s, (at.y + Math.sin(a - 2.5) * size) * s);
  ctx.stroke();
}

function star(ctx: CanvasRenderingContext2D, c: Point, r: number, s: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = (c.x + Math.cos(a) * rad) * s;
    const y = (c.y + Math.sin(a) * rad) * s;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** `c` is the badge's centre (see badgeCenters). */
export function drawBadge(ctx: CanvasRenderingContext2D, item: TraceItem, order: number, c: Point, s: number, lit: boolean) {
  ctx.fillStyle = lit ? COLORS.badge : "#D0C3F6";
  ctx.beginPath();
  ctx.arc(c.x * s, c.y * s, 24 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.badgeText;
  ctx.font = `700 ${28 * s}px "Noto Sans Khmer", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge(order, item), c.x * s, (c.y + 1) * s);
  ctx.textAlign = "start";
}

/** Pull a drawn point toward the current stroke — what the child sees, never what is scored. */
function assisted(points: Point[], target: PreparedStroke | undefined, amount: number, r: number): Point[] {
  if (!target || amount <= 0 || target.dot) return points;
  return points.map((p) => {
    const n = nearest(target.track, p);
    if (n.dist > 2 * r) return p;
    return { x: p.x + (n.point.x - p.x) * amount, y: p.y + (n.point.y - p.y) * amount };
  });
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, s: number) {
  const { item, prepared, switches: sw, current, done, aids } = scene;
  const looks = prepared.map((p) => lookOf(item, p.stroke));
  const polys = prepared.map((p) => strokePolyline(p.stroke));
  // Part by part: only the parts up to the one being drawn are on the slate; the parts before it read as finished ink.
  const byParts = isPartByPart(item);
  const partOf = partIndexes(prepared.map((p) => p.stroke));
  const nowPart = byParts && current >= 0 ? partOf[current] : Infinity;
  // A part already drawn reads as finished ink (and, once the picture is done, every part does).
  const earlier = (i: number) => byParts && partOf[i] < nowPart;
  const newPart = (i: number) => byParts && partOf[i] === nowPart && !done.has(i);
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, 1000 * s, 1000 * s);
  if (sw.grid) drawGrid(ctx, item, s);
  drawCarrier(ctx, item, s, aids.includes("zone"));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ghost: the shape, faded underneath (dotted outline in the faded step).
  const ghost = (i: number) => {
    const p = prepared[i];
    const poly = polys[i];
    const thin = looks[i].thin;
    if (p.dot) {
      ghostDot(ctx, poly[0], p.stroke.radius ?? 20, looks[i], s, newPart(i) ? COLORS.tip : undefined);
      return;
    }
    if (scene.dotted) {
      ctx.strokeStyle = "#B794F4";
      ctx.lineWidth = 6 * s;
      ctx.setLineDash([2 * s, 18 * s]);
      line(ctx, poly, s);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // The part to draw now stands out from the picture around it.
      const { dashed, dotted } = looks[i];
      // Dots read best a little bolder than a line of the same width.
      const w = ghostWidth(thin, p.stroke.width) * (dotted ? 1.4 : 1);
      ctx.strokeStyle = newPart(i) ? COLORS.tip : dashed || dotted ? COLORS.dash : thin ? COLORS.outline : COLORS.ghost;
      ctx.lineWidth = w * s;
      ctx.setLineDash(pattern(looks[i], w, s));
      line(ctx, poly, s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  // Path bands: done strokes green, the current one bright, the rest light.
  const showBand = sw.strokes || aids.includes("widerBand");
  const band = (i: number) => {
    // Only while drawing: a finished part needs no band; a finished picture (review) shows them all.
    if (current >= 0 && earlier(i)) return;
    const p = prepared[i];
    const poly = polys[i];
    const isCurrent = i === current;
    const { thin, hideArrows } = looks[i];
    const dim = scene.dimOthers && current >= 0 && !isCurrent;
    // Thin: only the current stroke and finished ones get a band, slim; the outline shows the rest.
    const banded = thin ? isCurrent || done.has(i) : sw.strokes || isCurrent;
    if (showBand && !p.dot && banded) {
      ctx.globalAlpha = dim ? 0.08 : thin ? (done.has(i) ? 0.9 : 0.45) : done.has(i) ? 0.5 : isCurrent ? 0.28 : 0.12;
      ctx.strokeStyle = done.has(i) ? COLORS.bandDone : COLORS.band;
      ctx.lineWidth = (thin ? (done.has(i) ? THIN.done : Math.min(THIN.current, scene.radii[i] * 2)) : scene.radii[i] * 2) * s;
      line(ctx, poly, s);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (showBand && p.dot) {
      ctx.globalAlpha = dim ? 0.08 : isCurrent ? 0.3 : 0.15;
      ctx.fillStyle = done.has(i) ? COLORS.bandDone : COLORS.band;
      ctx.beginPath();
      ctx.arc(poly[0].x * s, poly[0].y * s, ((p.stroke.radius ?? 20) + scene.radii[i] * 0.5) * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Arrows along the stroke (thin: the current stroke only, smaller).
    const wanted = hideArrows ? isCurrent && aids.includes("arrows") : sw.arrows || (isCurrent && aids.includes("arrows"));
    const arrows = wanted && (!thin || isCurrent) && !p.dot && !done.has(i) && !dim;
    if (arrows) {
      const t = track(poly);
      ctx.strokeStyle = COLORS.band;
      ctx.lineWidth = (thin ? 4 : 6) * s;
      const every = thin ? 80 : 110;
      for (let d = every * 0.6; d < t.length - 20; d += every) chevron(ctx, pointAt(t, d), pointAt(t, d + 10), thin ? 12 : 20, s);
    }
  };

  const cur = prepared[current];
  const ink = (stroke: SceneInk) => {
    const pts = soften(stroke.state === "pending" ? assisted(stroke.points, cur, scene.assist, scene.radii[current] ?? 30) : stroke.points);
    const finished = stroke.stroke !== undefined && earlier(stroke.stroke);
    ctx.strokeStyle = finished ? COLORS.ink : stroke.state === "ok" ? COLORS.ok : stroke.state === "rejected" ? COLORS.bad : COLORS.ink;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = stroke.state === "rejected" ? 0.45 : 1;
    const at = prepared[stroke.stroke ?? current];
    ctx.lineWidth = inkWidth(at?.stroke.width ?? 60, (looks[stroke.stroke ?? current] ?? lookOf(item, {})).thin) * s;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * s, pts[0].y * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      curve(ctx, pts, s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // The picture, back to front: a solid shape, once drawn, paints out what lies behind it —
  // ghost, band and ink alike. The stroke to write now always stays on top.
  const settled = new Map<number, SceneInk[]>();
  const loose: SceneInk[] = [];
  for (const e of scene.ink) {
    if (e.stroke !== undefined && e.state === "ok") settled.set(e.stroke, [...(settled.get(e.stroke) ?? []), e]);
    else loose.push(e);
  }
  for (const i of stackOrder(prepared.map((p) => p.stroke))) {
    if (partOf[i] > nowPart) continue;
    if (done.has(i) && isSolid(prepared[i].stroke)) paperFill(ctx, polys[i], s);
    if (sw.ghost) ghost(i);
    if (i !== current) band(i);
    for (const e of settled.get(i) ?? []) ink(e);
  }
  if (cur) band(current);

  // Coach hints on the current stroke.
  if (cur) {
    const poly = polys[current];
    if (aids.includes("checkpointStar")) {
      ctx.fillStyle = COLORS.badge;
      for (const c of cur.checkpoints.slice(1, -1)) star(ctx, c.point, 16, s);
    }
    if (aids.includes("endDot") && !cur.dot) {
      ctx.fillStyle = COLORS.bad;
      const e = poly[poly.length - 1];
      ctx.beginPath();
      ctx.arc(e.x * s, e.y * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (sw.startDot || aids.includes("startRing")) {
      const big = aids.includes("startRing");
      const r = (big ? 22 + 8 * scene.pulse : 13 + 4 * scene.pulse) * s;
      ctx.strokeStyle = COLORS.start;
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.arc(poly[0].x * s, poly[0].y * s, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.start;
      ctx.beginPath();
      ctx.arc(poly[0].x * s, poly[0].y * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Badges.
  if (sw.numbers || aids.includes("numbersDim")) {
    const centers = badgeCenters(prepared.map((p) => p.stroke));
    prepared.forEach((p, i) => {
      if (partOf[i] > nowPart || looks[i].hideNumbers || (p.stroke.join === "continue" && !sw.numbers)) return;
      drawBadge(ctx, item, p.stroke.order, centers[i], s, current < 0 || i === current || done.has(i));
    });
  }

  // The ink still being written (or checked) sits on top of everything.
  for (const e of loose) ink(e);
}

/**
 * Watch stroke order: the magic pen draws strokes up to `progress`
 * (0…n, where 1.5 = stroke 1 done, stroke 2 half drawn).
 */
export function drawWatch(ctx: CanvasRenderingContext2D, item: TraceItem, prepared: PreparedStroke[], progress: number, s: number, only?: number) {
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, 1000 * s, 1000 * s);
  drawGrid(ctx, item, s);
  drawCarrier(ctx, item, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const centers = badgeCenters(prepared.map((p) => p.stroke));
  const local = (i: number) => (only !== undefined ? progress : progress - i);
  // Part by part: the pen's part and the ones before it; the part being drawn stands out.
  const partOf = partIndexes(prepared.map((p) => p.stroke));
  const byParts = isPartByPart(item) && only === undefined && prepared.length > 0;
  const nowPart = byParts ? partOf[Math.min(prepared.length - 1, Math.max(0, Math.floor(progress)))] : Infinity;
  const shown = (i: number) => (only === undefined || i === only) && partOf[i] <= nowPart;

  const pen = (i: number) => {
    const p = prepared[i];
    const t = track(strokePolyline(p.stroke));
    const upto = Math.min(1, local(i)) * t.length;
    const drawn = t.points.filter((_, k) => t.cum[k] <= upto);
    const tip = pointAt(t, upto);
    drawn.push(tip);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = inkWidth(p.stroke.width, false) * s;
    if (p.dot) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(p.start.x * s, p.start.y * s, Math.max(6, p.stroke.radius ?? 12) * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      line(ctx, drawn, s);
      ctx.stroke();
    }
    return tip;
  };

  // The picture back to front: a finished solid shape covers what lies behind it.
  for (const i of stackOrder(prepared.map((p) => p.stroke))) {
    if (!shown(i)) continue;
    const p = prepared[i];
    const poly = strokePolyline(p.stroke);
    if (local(i) >= 1 && isSolid(p.stroke)) paperFill(ctx, poly, s);
    const look = lookOf(item, p.stroke);
    const { thin, dashed, dotted } = look;
    const w = ghostWidth(thin, p.stroke.width) * (dotted ? 1.4 : 1);
    const lit = byParts && partOf[i] === nowPart && local(i) < 1;
    ctx.strokeStyle = lit ? COLORS.tip : dashed || dotted ? COLORS.dash : thin ? COLORS.outline : COLORS.ghost;
    ctx.lineWidth = w * s;
    // A dot is in the faint picture from the start, like every line (the eyes of a star).
    if (p.dot && local(i) < 1) ghostDot(ctx, p.start, p.stroke.radius ?? 20, look, s, lit ? COLORS.tip : undefined);
    if (!p.dot) {
      ctx.setLineDash(pattern(look, w, s));
      line(ctx, poly, s);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (local(i) >= 1) pen(i);
  }

  // The stroke being written now, on top, with the magic pen's glowing tip.
  prepared.forEach((_, i) => {
    if (!shown(i) || local(i) <= 0 || local(i) >= 1) return;
    const tip = pen(i);
    const g = ctx.createRadialGradient(tip.x * s, tip.y * s, 0, tip.x * s, tip.y * s, 34 * s);
    g.addColorStop(0, "rgba(159,122,234,0.95)");
    g.addColorStop(1, "rgba(159,122,234,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x * s, tip.y * s, 34 * s, 0, Math.PI * 2);
    ctx.fill();
  });

  prepared.forEach((p, i) => {
    if (shown(i) && !lookOf(item, p.stroke).hideNumbers) drawBadge(ctx, item, p.stroke.order, centers[i], s, local(i) > 0);
  });
}
