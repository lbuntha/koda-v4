import { describe, expect, it } from "vitest";
import { CHA } from "../fixtures/items";
import { idealAll, moved, rng, timed } from "../fixtures/traces";
import { resample } from "../geometry/polyline";
import { dist } from "../geometry/vec";
import { cleanInk } from "./capture";
import { applyTransform, fitInk } from "./fitInk";
import { assign, dtw } from "./match";
import { radius } from "./tolerance";

function bruteForce(cost: number[][]): number {
  const cols = cost[0].length;
  const best = (row: number, used: Set<number>): number => {
    if (row === cost.length) return 0;
    let min = Infinity;
    for (let j = 0; j < cols; j++) {
      if (used.has(j)) continue;
      used.add(j);
      min = Math.min(min, cost[row][j] + best(row + 1, used));
      used.delete(j);
    }
    return min;
  };
  return best(0, new Set());
}

describe("assign (Hungarian)", () => {
  it("finds the cheapest pairing, same as trying every one", () => {
    const r = rng(7);
    for (const [rows, cols] of [
      [4, 4],
      [5, 5],
      [3, 6],
    ]) {
      for (let trial = 0; trial < 20; trial++) {
        const cost = Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.round(r() * 100)));
        const pairs = assign(cost, 1e9);
        expect(new Set(pairs).size).toBe(rows);
        expect(pairs.reduce((a, j, i) => a + cost[i][j], 0)).toBe(bruteForce(cost));
      }
    }
  });

  it("leaves a pair unmatched when it costs more than the limit", () => {
    expect(assign([[1, 50], [50, 90]], 10)).toEqual([0, -1]);
  });
});

describe("dtw", () => {
  it("is zero for the same path and large for the reversed one", () => {
    const path = resample([{ x: 0, y: 0 }, { x: 500, y: 0 }], 10);
    expect(dtw(path, path)).toBe(0);
    expect(dtw(path, [...path].reverse())).toBeGreaterThan(100);
  });
});

describe("capture", () => {
  it("joins a lift that restarts at once, nearby — a wobble, not a new stroke", () => {
    const ink = timed([
      [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      [{ x: 210, y: 105 }, { x: 300, y: 100 }],
    ], 10, 80);
    expect(cleanInk(ink)).toHaveLength(1);
  });

  it("keeps a real lift as two strokes", () => {
    const ink = timed([
      [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      [{ x: 500, y: 500 }, { x: 600, y: 500 }],
    ], 10, 400);
    expect(cleanInk(ink)).toHaveLength(2);
  });

  it("drops points closer than 2 units and keeps both ends", () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: 100 + i * 0.5, y: 100, t: i }));
    const [clean] = cleanInk([pts]);
    expect(clean.length).toBeLessThan(20);
    expect(clean[0]).toEqual({ x: 100, y: 100 });
    expect(clean[clean.length - 1]).toEqual({ x: 124.5, y: 100 });
  });
});

describe("fitInk", () => {
  it("puts a letter written small, tilted and off-centre back over the item", () => {
    const target = idealAll(CHA).map((s) => resample(s, 16));
    const ink = moved(target, { scale: 0.55, dx: 120, dy: 90, rotation: 7 });
    const { transform, cost } = fitInk(ink, target);
    expect(cost).toBeLessThan(6);
    const back = applyTransform(ink[0][0], transform);
    expect(dist(back, target[0][0])).toBeLessThan(15);
  });

  it("does not straighten a letter tilted more than the limit", () => {
    const target = idealAll(CHA).map((s) => resample(s, 16));
    const { cost } = fitInk(moved(target, { rotation: 35 }), target);
    expect(cost).toBeGreaterThan(15);
  });
});

describe("tolerance", () => {
  it("r = half the band × sensitivity × step × age band", () => {
    expect(radius(60)).toBe(30);
    expect(radius(60, { sensitivity: "relaxed" })).toBeCloseTo(48);
    expect(radius(60, { sensitivity: "strict", step: "memory", ageBand: "A" })).toBeCloseTo(30 * 0.7 * 1.3 * 1.2);
  });
});
