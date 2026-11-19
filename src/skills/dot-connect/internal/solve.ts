import { manhattan, neighbours } from "./grid";

/**
 * Counts answers to a fill-the-board puzzle, stopping at `limit`.
 *
 * Each colour grows from its first dot. The colour with the fewest moves goes
 * next, so forced moves are taken without branching; `branches` counts the
 * places a choice had to be tried, which is the difficulty measure. Prunes,
 * all of them conditions every answer must meet:
 *
 * - an open square needs two ways to be passed through;
 * - a bridge's unused way needs a passable square on both sides;
 * - every open region must be reachable by one unfinished colour from both
 *   ends (skipped on bridge boards, where a region can be reached across one);
 * - a step-count line must still be able to land on exactly its count.
 *
 * A search that hits `nodeLimit` reports `capped` — callers treat that as
 * "unknown", never as unique.
 */
export interface SolveInput {
  size: number;
  walls: number[];
  pairs: Array<[number, number]>;
  bridges?: number[];
  steps?: { pair: number; steps: number };
  /** Lines already drawn, each starting on `pairs[k][0]`. */
  prefix?: number[][];
}

export interface SolveResult {
  count: number;
  solution: number[][] | null;
  nodes: number;
  branches: number;
  capped: boolean;
}

const EMPTY = -1;
const WALL = -2;
const BRIDGE = -3;

export function solve(input: SolveInput, limit = 2, nodeLimit = 200_000): SolveResult {
  const { size, pairs } = input;
  const n = size * size;
  const owner = new Int16Array(n).fill(EMPTY);
  for (const w of input.walls) owner[w] = WALL;
  const bridgeList = input.bridges ?? [];
  // Per bridge, the colour using each way: [across, down].
  const slots = new Map<number, [number, number]>();
  for (const b of bridgeList) { owner[b] = BRIDGE; slots.set(b, [EMPTY, EMPTY]); }
  const K = pairs.length;
  const target = pairs.map((p) => p[1]);
  const paths: number[][] = pairs.map((p) => [p[0]]);
  const done: boolean[] = new Array(K).fill(false);
  pairs.forEach(([a, b], k) => { owner[a] = k; owner[b] = k; });
  const stepsOf = (k: number) => (input.steps && input.steps.pair === k ? input.steps.steps : undefined);

  const result: SolveResult = { count: 0, solution: null, nodes: 0, branches: 0, capped: false };
  const sameRow = (a: number, b: number) => Math.floor(a / size) === Math.floor(b / size);

  /** Where a step from `from` into `into` lands, crossing a bridge if there is one. */
  const landing = (k: number, from: number, into: number): number[] | null => {
    if (owner[into] === BRIDGE) {
      const d = into - from;
      const axis = Math.abs(d) === 1 ? 0 : 1;
      if (slots.get(into)![axis] !== EMPTY) return null;
      const beyond = into + d;
      if (beyond < 0 || beyond >= n || (axis === 0 && !sameRow(into, beyond))) return null;
      if (owner[beyond] === EMPTY || beyond === target[k]) return [into, beyond];
      return null;
    }
    if (owner[into] === EMPTY || into === target[k]) return [into];
    return null;
  };

  const take = (k: number, cells: number[]) => {
    const from = paths[k][paths[k].length - 1];
    let prev = from;
    for (const cell of cells) {
      if (owner[cell] === BRIDGE) slots.get(cell)![Math.abs(cell - prev) === 1 ? 0 : 1] = k;
      else if (cell === target[k]) done[k] = true;
      else owner[cell] = k;
      paths[k].push(cell);
      prev = cell;
    }
  };
  const give = (k: number, cells: number[]) => {
    for (let i = cells.length - 1; i >= 0; i -= 1) {
      const cell = cells[i];
      paths[k].pop();
      const prev = paths[k][paths[k].length - 1];
      if (owner[cell] === BRIDGE) slots.get(cell)![Math.abs(cell - prev) === 1 ? 0 : 1] = EMPTY;
      else if (cell === target[k]) done[k] = false;
      else owner[cell] = EMPTY;
    }
  };

  // Lay down any prefix; an illegal one simply has no answers.
  if (input.prefix) {
    for (let k = 0; k < K; k += 1) {
      const line = input.prefix[k];
      if (!line || line.length <= 1) continue;
      if (line[0] !== pairs[k][0]) return result;
      let i = 1;
      while (i < line.length && !done[k]) {
        const head = paths[k][paths[k].length - 1];
        if (!neighbours(head, size).includes(line[i])) return result;
        const cells = landing(k, head, line[i]);
        if (!cells || (cells.length === 2 && line[i + 1] !== cells[1])) return result;
        take(k, cells);
        i += cells.length;
      }
    }
  }

  const headOf = (k: number) => paths[k][paths[k].length - 1];
  const options = (k: number): number[][] => {
    const out: number[][] = [];
    const head = headOf(k);
    const limitSteps = stepsOf(k);
    const taken = paths[k].length - 1;
    for (const nb of neighbours(head, size)) {
      const cells = landing(k, head, nb);
      if (!cells) continue;
      const end = cells[cells.length - 1];
      if (limitSteps !== undefined) {
        const used = taken + cells.length;
        if (end === target[k]) { if (used !== limitSteps) continue; } else {
          const left = limitSteps - used - manhattan(end, target[k], size);
          // The board is a chessboard: every step changes colour, so what is
          // left over must be an even number of steps to waste.
          if (left < 0 || left % 2 !== 0) continue;
        }
      }
      out.push(cells);
    }
    return out;
  };

  const region = new Int32Array(n);
  const viable = (): boolean => {
    const liveHead = new Set<number>();
    const liveTarget = new Set<number>();
    for (let k = 0; k < K; k += 1) {
      if (done[k]) continue;
      if (options(k).length === 0) return false;
      liveHead.add(headOf(k));
      liveTarget.add(target[k]);
    }
    const passable = (c: number) => owner[c] === EMPTY || liveHead.has(c) || liveTarget.has(c);
    // Every open square must be passable: one way in and one way out.
    for (let c = 0; c < n; c += 1) {
      if (owner[c] !== EMPTY) continue;
      let ways = 0;
      for (const nb of neighbours(c, size)) {
        if (passable(nb)) ways += 1;
        else if (owner[nb] === BRIDGE && slots.get(nb)![Math.abs(nb - c) === 1 ? 0 : 1] === EMPTY) ways += 1;
      }
      if (ways < 2) return false;
    }
    // A bridge way still to be used needs a way on and a way off.
    for (const b of bridgeList) {
      const [across, down] = slots.get(b)!;
      if (across === EMPTY && !(b % size > 0 && b % size < size - 1 && passable(b - 1) && passable(b + 1))) return false;
      if (down === EMPTY && !(b >= size && b < n - size && passable(b - size) && passable(b + size))) return false;
    }
    if (bridgeList.length) return true;

    // Label open regions, then check each is served by one colour from both ends.
    region.fill(-1);
    let regions = 0;
    const stack: number[] = [];
    for (let c = 0; c < n; c += 1) {
      if (owner[c] !== EMPTY || region[c] !== -1) continue;
      region[c] = regions; stack.push(c);
      while (stack.length) {
        const cur = stack.pop()!;
        for (const nb of neighbours(cur, size)) {
          if (owner[nb] === EMPTY && region[nb] === -1) { region[nb] = regions; stack.push(nb); }
        }
      }
      regions += 1;
    }
    const heads: Array<Set<number>> = Array.from({ length: regions }, () => new Set());
    const tails: Array<Set<number>> = Array.from({ length: regions }, () => new Set());
    for (let k = 0; k < K; k += 1) {
      if (done[k]) continue;
      for (const nb of neighbours(headOf(k), size)) if (owner[nb] === EMPTY) heads[region[nb]].add(k);
      for (const nb of neighbours(target[k], size)) if (owner[nb] === EMPTY) tails[region[nb]].add(k);
    }
    for (let r = 0; r < regions; r += 1) {
      let served = false;
      for (const k of heads[r]) if (tails[r].has(k)) { served = true; break; }
      if (!served) return false;
    }
    for (let k = 0; k < K; k += 1) {
      if (done[k]) continue;
      if (neighbours(headOf(k), size).includes(target[k])) continue;
      let linked = false;
      for (let r = 0; r < regions && !linked; r += 1) linked = heads[r].has(k) && tails[r].has(k);
      if (!linked) return false;
    }
    return true;
  };

  const full = (): boolean => {
    for (let c = 0; c < n; c += 1) if (owner[c] === EMPTY) return false;
    for (const [across, down] of slots.values()) if (across === EMPTY || down === EMPTY) return false;
    return true;
  };

  const search = (): void => {
    result.nodes += 1;
    if (result.nodes > nodeLimit) { result.capped = true; return; }
    let pick = -1;
    let best: number[][] = [];
    for (let k = 0; k < K; k += 1) {
      if (done[k]) continue;
      const opts = options(k);
      if (pick === -1 || opts.length < best.length) { pick = k; best = opts; }
      if (best.length <= 1) break;
    }
    if (pick === -1) {
      if (!full()) return;
      result.count += 1;
      if (!result.solution) result.solution = paths.map((p) => p.slice());
      return;
    }
    if (best.length > 1) result.branches += 1;
    for (const cells of best) {
      take(pick, cells);
      if (viable()) search();
      give(pick, cells);
      if (result.count >= limit || result.capped) return;
    }
  };

  if (viable()) search();
  return result;
}
