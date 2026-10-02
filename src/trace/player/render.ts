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
} as const;

const KM_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];

/** A stroke badge in the item's own numerals: ១ ២ ៣ for Khmer, 1 2 3 otherwise. */
export const badge = (n: number, item: Pick<TraceItem, "script" | "numerals">) =>
  (item.numerals ?? (item.script === "khmer" ? "khmer" : "latin")) === "khmer" ? String(n).replace(/\d/g, (d) => KM_DIGITS[+d]) : String(n);

export interface SceneInk {
  points: Point[];
  state: "pending" | "ok" | "rejected";
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
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, 1000 * s, 1000 * s);
  if (sw.grid) drawGrid(ctx, item, s);
  drawCarrier(ctx, item, s, aids.includes("zone"));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ghost: the shape, faded underneath (dotted outline in the faded step).
  if (sw.ghost) {
    for (const p of prepared) {
      const poly = strokePolyline(p.stroke);
      if (p.dot) {
        ctx.fillStyle = COLORS.ghost;
        ctx.beginPath();
        ctx.arc(poly[0].x * s, poly[0].y * s, (p.stroke.radius ?? 20) * s, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (scene.dotted) {
        ctx.strokeStyle = "#B794F4";
        ctx.lineWidth = 6 * s;
        ctx.setLineDash([2 * s, 18 * s]);
        line(ctx, poly, s);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = COLORS.ghost;
        ctx.lineWidth = p.stroke.width * 0.75 * s;
        line(ctx, poly, s);
        ctx.stroke();
      }
    }
  }

  // Path bands: done strokes green, the current one bright, the rest light.
  const showBand = sw.strokes || aids.includes("widerBand");
  prepared.forEach((p, i) => {
    const poly = strokePolyline(p.stroke);
    const isCurrent = i === current;
    const dim = scene.dimOthers && current >= 0 && !isCurrent;
    if (showBand && !p.dot && (sw.strokes || isCurrent)) {
      ctx.globalAlpha = dim ? 0.08 : done.has(i) ? 0.5 : isCurrent ? 0.28 : 0.12;
      ctx.strokeStyle = done.has(i) ? COLORS.bandDone : COLORS.band;
      ctx.lineWidth = scene.radii[i] * 2 * s;
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
    // Arrows along the stroke.
    const arrows = (sw.arrows || (isCurrent && aids.includes("arrows"))) && !p.dot && !done.has(i) && !dim;
    if (arrows) {
      const t = track(poly);
      ctx.strokeStyle = COLORS.band;
      ctx.lineWidth = 6 * s;
      const every = 110;
      for (let d = every * 0.6; d < t.length - 20; d += every) chevron(ctx, pointAt(t, d), pointAt(t, d + 10), 20, s);
    }
  });

  // Coach hints on the current stroke.
  const cur = prepared[current];
  if (cur) {
    const poly = strokePolyline(cur.stroke);
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
      if (p.stroke.join === "continue" && !sw.numbers) return;
      drawBadge(ctx, item, p.stroke.order, centers[i], s, current < 0 || i === current || done.has(i));
    });
  }

  // Ink.
  for (const stroke of scene.ink) {
    const pts = stroke.state === "pending" ? assisted(stroke.points, cur, scene.assist, scene.radii[current] ?? 30) : stroke.points;
    ctx.strokeStyle = stroke.state === "ok" ? COLORS.ok : stroke.state === "rejected" ? COLORS.bad : COLORS.ink;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.globalAlpha = stroke.state === "rejected" ? 0.45 : 1;
    ctx.lineWidth = 16 * s;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * s, pts[0].y * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      line(ctx, pts, s);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
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
  prepared.forEach((p, i) => {
    if (only !== undefined && i !== only) return;
    const poly = strokePolyline(p.stroke);
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = p.stroke.width * 0.75 * s;
    if (!p.dot) {
      line(ctx, poly, s);
      ctx.stroke();
    }
  });
  prepared.forEach((p, i) => {
    if (only !== undefined && i !== only) return;
    const local = only !== undefined ? progress : progress - i;
    if (local <= 0) {
      drawBadge(ctx, item, p.stroke.order, centers[i], s, false);
      return;
    }
    const t = track(strokePolyline(p.stroke));
    const upto = Math.min(1, local) * t.length;
    const drawn = t.points.filter((_, k) => t.cum[k] <= upto);
    const tip = pointAt(t, upto);
    drawn.push(tip);
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 16 * s;
    if (p.dot) {
      ctx.fillStyle = COLORS.ink;
      ctx.beginPath();
      ctx.arc(p.start.x * s, p.start.y * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      line(ctx, drawn, s);
      ctx.stroke();
    }
    drawBadge(ctx, item, p.stroke.order, centers[i], s, true);
    if (local < 1) {
      // The magic pen's glowing tip.
      const g = ctx.createRadialGradient(tip.x * s, tip.y * s, 0, tip.x * s, tip.y * s, 34 * s);
      g.addColorStop(0, "rgba(159,122,234,0.95)");
      g.addColorStop(1, "rgba(159,122,234,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tip.x * s, tip.y * s, 34 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
