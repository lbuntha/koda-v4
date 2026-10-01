import { describe, expect, it } from "vitest";
import { polylineLength } from "./polyline";
import type { Point } from "./types";
import { dist } from "./vec";
import type { Mask } from "./vectorize";
import { cleanPlan, pieces, readingOrder, strokesFromPlan, thin } from "./vectorize";

const N = 128;
/** A mask of thick lines (and rings), drawn in 0–1000 units. */
function draw(shapes: ({ line: [Point, Point] } | { ring: { c: Point; r: number } })[], thickness = 70): Mask {
  const on = new Uint8Array(N * N);
  const k = 1000 / N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = { x: (x + 0.5) * k, y: (y + 0.5) * k };
      for (const s of shapes) {
        let d: number;
        if ("line" in s) {
          const [a, b] = s.line;
          const vx = b.x - a.x;
          const vy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)));
          d = dist(p, { x: a.x + vx * t, y: a.y + vy * t });
        } else d = Math.abs(dist(p, s.ring.c) - s.ring.r);
        if (d <= thickness / 2) on[y * N + x] = 1;
      }
    }
  }
  return { w: N, h: N, on };
}
const P = (x: number, y: number) => ({ x, y });
let n = 0;
const id = () => `s${n++}`;

describe("thinning", () => {
  it("leaves a line one pixel wide", () => {
    const sk = thin(draw([{ line: [P(500, 150), P(500, 850)] }]));
    for (let y = 0; y < N; y++) {
      let row = 0;
      for (let x = 0; x < N; x++) row += sk.on[y * N + x];
      expect(row).toBeLessThanOrEqual(1);
    }
  });
});

describe("pieces", () => {
  it("a thick bar becomes one straight piece along its middle", () => {
    const ps = pieces(draw([{ line: [P(500, 150), P(500, 850)] }]));
    expect(ps).toHaveLength(1);
    expect(polylineLength(ps[0].points)).toBeGreaterThan(550);
    for (const q of ps[0].points) expect(Math.abs(q.x - 500)).toBeLessThan(20);
  });

  it("an L is one piece, bending at the corner", () => {
    const ps = pieces(draw([{ line: [P(300, 200), P(300, 800)] }, { line: [P(300, 800), P(800, 800)] }]));
    expect(ps).toHaveLength(1);
  });

  it("a T splits into three pieces at its crossing", () => {
    const ps = pieces(draw([{ line: [P(200, 250), P(800, 250)] }, { line: [P(500, 250), P(500, 850)] }]));
    expect(ps).toHaveLength(3);
  });

  it("a ring is one closed loop", () => {
    const ps = pieces(draw([{ ring: { c: P(500, 500), r: 280 } }]));
    expect(ps).toHaveLength(1);
    expect(ps[0].closed).toBe(true);
  });
});

describe("pieces → strokes", () => {
  const bars = pieces(draw([{ line: [P(250, 200), P(250, 800)] }, { line: [P(700, 200), P(700, 800)] }]));

  it("reading order: left bar first, each drawn top to bottom", () => {
    const strokes = strokesFromPlan(bars, readingOrder(bars), id);
    expect(strokes).toHaveLength(2);
    expect(strokes[0].nodes[0].x).toBeLessThan(400);
    for (const s of strokes) expect(s.nodes[0].y).toBeLessThan(s.nodes[s.nodes.length - 1].y);
    expect(strokes.map((s) => s.order)).toEqual([1, 2]);
  });

  it("an order is followed, reversals included, and a bad one is repaired", () => {
    const right = bars.find((b) => b.points[0].x > 500)!;
    const plan = cleanPlan([{ pieces: [{ id: right.id, reverse: true }] }, { pieces: [{ id: 99 }] }, { pieces: [{ id: right.id }] }], bars);
    expect(plan).toHaveLength(2); // the right bar once, then the forgotten left bar
    expect(plan[0].pieces[0]).toEqual({ id: right.id, reverse: true });
    const strokes = strokesFromPlan(bars, plan, id);
    expect(strokes[0].nodes[0].x).toBeGreaterThan(500);
  });

  it("two pieces joined into one stroke make one motion", () => {
    const T = pieces(draw([{ line: [P(200, 250), P(800, 250)] }, { line: [P(500, 250), P(500, 850)] }]));
    const strokes = strokesFromPlan(T, [{ pieces: T.slice(0, 2).map((p) => ({ id: p.id, reverse: false })) }, { pieces: [{ id: T[2].id, reverse: false }] }], id);
    expect(strokes).toHaveLength(2);
  });
});
