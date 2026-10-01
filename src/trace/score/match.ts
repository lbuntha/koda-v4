/**
 * Pairing things up: DTW for how well two paths follow each other, and the
 * Hungarian algorithm for which ink stroke is which target stroke when the
 * child wrote with no guide.
 */

import type { Point } from "../geometry/types";
import { dist } from "../geometry/vec";

/**
 * Dynamic time warping: the mean distance along the best alignment of `a`
 * and `b`, walking both from start to end. Low = same path, same direction.
 */
export function dtw(a: Point[], b: Point[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  let prevCost = new Float64Array(m + 1).fill(Infinity);
  let prevSteps = new Float64Array(m + 1);
  prevCost[0] = 0;
  let cost = new Float64Array(m + 1);
  let steps = new Float64Array(m + 1);
  for (let i = 1; i <= n; i++) {
    cost[0] = Infinity;
    steps[0] = 0;
    for (let j = 1; j <= m; j++) {
      const d = dist(a[i - 1], b[j - 1]);
      let best = prevCost[j - 1];
      let bestSteps = prevSteps[j - 1];
      if (prevCost[j] < best) {
        best = prevCost[j];
        bestSteps = prevSteps[j];
      }
      if (cost[j - 1] < best) {
        best = cost[j - 1];
        bestSteps = steps[j - 1];
      }
      cost[j] = best + d;
      steps[j] = bestSteps + 1;
    }
    [prevCost, cost] = [cost, prevCost];
    [prevSteps, steps] = [steps, prevSteps];
  }
  return prevCost[m] / prevSteps[m];
}

/**
 * Minimum-cost assignment (Kuhn–Munkres). `cost` is rows × cols; returns, for
 * each row, its column or -1. A pair costing more than `unmatched` is left
 * unpaired instead — the ink didn't really draw that stroke.
 */
export function assign(cost: number[][], unmatched: number): number[] {
  const rows = cost.length;
  const cols = rows === 0 ? 0 : cost[0].length;
  if (rows === 0) return [];
  // Square matrix with dummies: leaving a row *and* a column unpaired costs
  // `unmatched` in total, so a real pair is taken only when it is cheaper.
  const size = rows + cols;
  const a = (i: number, j: number) => {
    if (i < rows && j < cols) return Math.min(cost[i][j], unmatched * 2);
    if (i < rows || j < cols) return unmatched / 2;
    return 0;
  };

  const INF = Infinity;
  const u = new Float64Array(size + 1);
  const v = new Float64Array(size + 1);
  const p = new Int32Array(size + 1);
  const way = new Int32Array(size + 1);
  for (let i = 1; i <= size; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(size + 1).fill(INF);
    const used = new Uint8Array(size + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= size; j++) {
        if (used[j]) continue;
        const cur = a(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= size; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const result = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= size; j++) {
    const i = p[j] - 1;
    const col = j - 1;
    if (i < rows && col < cols && cost[i][col] <= unmatched) result[i] = col;
  }
  return result;
}
