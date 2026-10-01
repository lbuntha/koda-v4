import { describe, expect, it } from "vitest";
import { cubicLength, evalCubic, splitCubic, strokePolyline } from "./bezier";
import { autoCheckpoints, withCheckpoints } from "./checkpoints";
import {
  bendSegment,
  blendAll,
  connectToPrevious,
  mirrorStroke,
  reverseStroke,
  setNodeType,
  simplifyStroke,
  splitSegment,
  straighten,
} from "./edit";
import { fitCubics, fitNodes } from "./fit";
import { nearest, polylineLength, resample, signedArea, track } from "./polyline";
import { snapPoint } from "./snap";
import type { Point, Stroke } from "./types";
import { cross, dist, len, normalize } from "./vec";
import { CHA, HOOK, LOOP, makeStroke } from "../fixtures/items";
import type { Cubic } from "./bezier";

const K = 0.5523; // handle length of a quarter circle, as a share of the radius
const circle = (r: number): Stroke => ({
  id: "c",
  order: 1,
  shape: "loop",
  closed: true,
  join: "lift",
  width: 60,
  checkpoints: [],
  nodes: [
    { x: 500, y: 500 - r, type: "symmetric", in: { dx: r * K, dy: 0 }, out: { dx: -r * K, dy: 0 } },
    { x: 500 - r, y: 500, type: "symmetric", in: { dx: 0, dy: -r * K }, out: { dx: 0, dy: r * K } },
    { x: 500, y: 500 + r, type: "symmetric", in: { dx: -r * K, dy: 0 }, out: { dx: r * K, dy: 0 } },
    { x: 500 + r, y: 500, type: "symmetric", in: { dx: 0, dy: r * K }, out: { dx: 0, dy: -r * K } },
  ],
});

/** Largest distance from any point of `a` to the polyline `b`. */
const deviation = (a: Point[], b: Point[]) => Math.max(...a.map((p) => nearest(track(b), p).dist));

const line = (x1: number, y1: number, x2: number, y2: number) =>
  makeStroke("l", 1, [
    [x1, y1],
    [x2, y2],
  ]);

describe("Bézier maths", () => {
  it("a segment with no handles is a straight line of the right length", () => {
    const poly = strokePolyline(line(100, 100, 800, 100));
    expect(polylineLength(poly)).toBeCloseTo(700, 6);
    expect(poly.every((p) => p.y === 100)).toBe(true);
  });

  it("four symmetric nodes draw a circle", () => {
    const poly = strokePolyline(circle(300));
    expect(polylineLength(poly)).toBeCloseTo(2 * Math.PI * 300, -1); // within ~5 units of 1885
    for (const p of poly) expect(Math.abs(dist(p, { x: 500, y: 500 }) - 300)).toBeLessThan(1);
  });

  it("splitting a curve does not change it", () => {
    const c: Cubic = [
      { x: 0, y: 0 },
      { x: 100, y: 300 },
      { x: 400, y: -100 },
      { x: 500, y: 200 },
    ];
    const [left, right] = splitCubic(c, 0.3);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(dist(evalCubic(left, t), evalCubic(c, 0.3 * t))).toBeLessThan(1e-9);
      expect(dist(evalCubic(right, t), evalCubic(c, 0.3 + 0.7 * t))).toBeLessThan(1e-9);
    }
    expect(cubicLength(left) + cubicLength(right)).toBeCloseTo(cubicLength(c), 1);
  });
});

describe("polylines", () => {
  it("resamples to even steps and keeps both ends", () => {
    const pts = resample(strokePolyline(HOOK.strokes[0]), 8);
    const gaps = pts.slice(1).map((p, i) => dist(p, pts[i]));
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1.5);
    expect(pts[0]).toEqual({ x: 400, y: 150 });
    expect(dist(pts[pts.length - 1], { x: 620, y: 720 })).toBeLessThan(1e-6);
  });

  it("finds the nearest point and its position along the line", () => {
    const n = nearest(track([{ x: 0, y: 0 }, { x: 100, y: 0 }]), { x: 30, y: 40 });
    expect(n.dist).toBe(40);
    expect(n.s).toBe(30);
  });

  it("a loop drawn top → left → bottom is anticlockwise: negative area on a y-down screen", () => {
    expect(signedArea(strokePolyline(LOOP.strokes[0]))).toBeLessThan(0);
    expect(signedArea(strokePolyline(reverseStroke(LOOP.strokes[0])))).toBeGreaterThan(0);
  });
});

describe("fitting curves to points (Freehand Pen)", () => {
  it("fits a sampled arc within the error asked for", () => {
    const pts: Point[] = [];
    for (let a = 0; a <= Math.PI; a += 0.05) pts.push({ x: 500 + 300 * Math.cos(a), y: 500 - 300 * Math.sin(a) });
    const cubics = fitCubics(pts, 1);
    const drawn = strokePolyline({ nodes: fitNodes(pts, 1), closed: false });
    expect(cubics.length).toBeLessThanOrEqual(6); // from 63 points
    expect(deviation(pts, drawn)).toBeLessThan(1.5);
  });

  it("a straight run of points becomes two nodes", () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({ x: 100 + i * 20, y: 300 }));
    expect(fitNodes(pts, 2)).toHaveLength(2);
  });
});

describe("stroke tools", () => {
  const flat = line(200, 500, 800, 500);
  const middle = (s: Stroke) => {
    const t = track(strokePolyline(s));
    return resample(t.points, t.length / 2)[1];
  };

  it("Bend Up bows the segment up, Bend Down bows it down, Straighten undoes both", () => {
    expect(middle(bendSegment(flat, 0, "up")).y).toBeLessThan(480);
    expect(middle(bendSegment(flat, 0, "down")).y).toBeGreaterThan(520);
    expect(middle(bendSegment(bendSegment(flat, 0, "up"), 0, "up")).y).toBeLessThan(middle(bendSegment(flat, 0, "up")).y);
    expect(middle(straighten(bendSegment(flat, 0, "up"))).y).toBeCloseTo(500, 6);
  });

  it("Reverse draws the same shape the other way", () => {
    const hook = HOOK.strokes[0];
    const a = strokePolyline(hook);
    const b = strokePolyline(reverseStroke(hook));
    expect(dist(a[0], b[b.length - 1])).toBeLessThan(1e-9);
    expect(deviation(a, b)).toBeLessThan(0.5);
  });

  it("Mirror flips across the centre line", () => {
    const m = mirrorStroke(line(100, 200, 300, 400), "horizontal");
    expect(m.nodes.map((n) => [n.x, n.y])).toEqual([
      [900, 200],
      [700, 400],
    ]);
  });

  it("Add Points splits a segment without changing the shape", () => {
    const bent = bendSegment(flat, 0, "up");
    const split = splitSegment(bent, 0, 0.4);
    expect(split.nodes).toHaveLength(3);
    expect(deviation(strokePolyline(split), strokePolyline(bent))).toBeLessThan(0.5);
  });

  it("Blend all rounds every inner corner, with handles in one line", () => {
    const zigzag = makeStroke("z", 1, [
      [100, 500],
      [300, 300],
      [500, 500],
      [700, 300],
    ]);
    const blended = blendAll(zigzag);
    for (const n of blended.nodes.slice(1, -1)) {
      expect(n.type).toBe("smooth");
      const a = normalize({ x: -n.in!.dx, y: -n.in!.dy });
      const b = normalize({ x: n.out!.dx, y: n.out!.dy });
      expect(Math.abs(cross(a, b))).toBeLessThan(1e-9);
    }
  });

  it("symmetric makes both handles the same length", () => {
    const s = setNodeType(bendSegment(splitSegment(flat, 0, 0.3), 1, "up", 0.4), 1, "symmetric");
    expect(len({ x: s.nodes[1].in!.dx, y: s.nodes[1].in!.dy })).toBeCloseTo(len({ x: s.nodes[1].out!.dx, y: s.nodes[1].out!.dy }), 9);
  });

  it("Simplify drops nodes that don't change the shape", () => {
    const pts: [number, number][] = [];
    for (let a = 0; a <= Math.PI / 2; a += Math.PI / 40) pts.push([500 + 300 * Math.cos(a), 500 - 300 * Math.sin(a)]);
    const dense = makeStroke("d", 1, pts);
    const simple = simplifyStroke(dense, 2);
    expect(simple.nodes.length).toBeLessThan(dense.nodes.length / 3);
    expect(deviation(strokePolyline(dense), strokePolyline(simple))).toBeLessThan(3);
  });

  it("Connect to Prev starts where the previous stroke ended and carries on", () => {
    const next = connectToPrevious(line(610, 790, 900, 900), line(100, 100, 600, 800));
    expect(next.nodes[0]).toMatchObject({ x: 600, y: 800 });
    expect(next.join).toBe("continue");
  });
});

describe("Magic Snap", () => {
  it("prefers another stroke's end, then the guide, then the grid", () => {
    const targets = { ends: [{ x: 110, y: 100 }], guide: [{ x: 95, y: 100 }], grid: 100 };
    expect(snapPoint({ x: 100, y: 102 }, targets).kind).toBe("end");
    expect(snapPoint({ x: 100, y: 102 }, { ...targets, ends: [] }).kind).toBe("guide");
    expect(snapPoint({ x: 104, y: 97 }, { grid: 100 })).toEqual({ point: { x: 100, y: 100 }, kind: "grid" });
    expect(snapPoint({ x: 150, y: 150 }, { grid: 100 }).kind).toBe("none");
  });

  it("snaps a nearly diagonal segment to exactly 45°", () => {
    const s = snapPoint({ x: 300, y: 290 }, { angleFrom: { x: 100, y: 100 } });
    expect(s.kind).toBe("angle");
    expect(s.point.x - 100).toBeCloseTo(s.point.y - 100, 9);
  });
});

describe("checkpoints", () => {
  it("a straight line gets its start, its end, and nothing more than 20% apart", () => {
    const cps = autoCheckpoints(line(500, 100, 500, 900));
    expect(cps[0]).toBe(0);
    expect(cps[cps.length - 1]).toBe(1);
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it("puts one on each sharp corner", () => {
    const stroke = CHA.strokes[0];
    const t = track(strokePolyline(stroke));
    const cps = autoCheckpoints(stroke);
    for (const corner of [
      { x: 310, y: 780 },
      { x: 700, y: 780 },
    ]) {
      const at = nearest(t, corner).s / t.length;
      expect(Math.min(...cps.map((c) => Math.abs(c - at)))).toBeLessThan(0.03);
    }
  });

  it("keeps a pinned checkpoint", () => {
    const s = withCheckpoints(HOOK.strokes[0]);
    expect(s.checkpoints.some((c) => c.pinned && c.t === 0.9)).toBe(true);
  });
});

import { badgeCenters } from "./badges";

describe("stroke number badges", () => {
  const a = makeStroke("a", 1, [[300, 400], [300, 800]]);
  const b = makeStroke("b", 2, [[300, 400], [700, 400]]);

  it("two strokes that start at the same point get badges that don't overlap", () => {
    const [ca, cb] = badgeCenters([a, b]);
    expect(dist(ca, cb)).toBeGreaterThanOrEqual(52);
  });

  it("a badge the admin placed stays exactly there, and the others move around it", () => {
    const placed = { ...b, badge: { dx: -34, dy: -34 } };
    const [ca, cb] = badgeCenters([a, placed]);
    expect(cb).toEqual({ x: 266, y: 366 });
    expect(dist(ca, cb)).toBeGreaterThanOrEqual(52);
  });
});

import { fitStroke, strokeBox, transformStroke } from "./edit";

describe("resize and fit", () => {
  const square = makeStroke("sq", 1, [[300, 300], [300, 700], [700, 700], [700, 300]], { closed: true });
  const small = makeStroke("c", 2, [[450, 450], [450, 550], [550, 550], [550, 450]], { closed: true });
  const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.5);

  it("scaling about a corner keeps that corner where it is", () => {
    const b = strokeBox(transformStroke(square, 0.5, 2, { x: 300, y: 300 }));
    near(b.minX, 300);
    near(b.minY, 300);
    near(b.maxX, 500);
    near(b.maxY, 1100);
  });

  it("stretch makes one stroke's box exactly another's", () => {
    const b = strokeBox(fitStroke(small, strokeBox(square), "stretch"));
    near(b.minX, 300);
    near(b.maxY, 700);
  });

  it("fit inside keeps the shape and centres it", () => {
    const wide = makeStroke("w", 1, [[100, 450], [100, 550], [900, 550], [900, 450]], { closed: true });
    const b = strokeBox(fitStroke(wide, strokeBox(square), "inside"));
    near(b.maxX - b.minX, 400);
    near(b.maxY - b.minY, 50);
    near((b.minY + b.maxY) / 2, 500);
  });

  it("a straight line can be fitted (it has no width)", () => {
    const line = makeStroke("l", 1, [[500, 100], [500, 300]]);
    const b = strokeBox(fitStroke(line, strokeBox(square), "height"));
    near(b.maxY - b.minY, 400);
    near(b.minX, 500);
  });
});
