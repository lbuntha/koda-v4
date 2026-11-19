import { manhattan, neighbours, onEdge } from "./grid";
import { solve } from "./solve";
import type { Board, Feature } from "./types";

/**
 * Proves a board shows what its lesson is about. Each check reads the board
 * as a child meets it — dots, walls and open squares — except `edge`, which
 * asks whether the answer itself runs along the edge.
 */

/** Shortest route between a pair's dots, around walls and other colours' dots. */
export function shortestJoin(board: Board, k: number): number {
  const { size, pairs } = board;
  const blocked = new Set<number>(board.walls);
  pairs.forEach(([a, b], j) => { if (j !== k) { blocked.add(a); blocked.add(b); } });
  const [from, to] = pairs[k];
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) return dist.get(cur)!;
    for (const nb of neighbours(cur, size)) {
      if (blocked.has(nb) || dist.has(nb)) continue;
      dist.set(nb, dist.get(cur)! + 1);
      queue.push(nb);
    }
  }
  return Infinity;
}

const dotSet = (board: Board) => new Set(board.pairs.flat());

/** A pair whose straight-line route is blocked, so its line has to go round. */
export const hasDetour = (board: Board) =>
  board.pairs.some(([a, b], k) => shortestJoin(board, k) > manhattan(a, b, board.size));

/** Joining every pair the short way leaves squares empty, so filling is a real rule. */
export function hasGap(board: Board): boolean {
  const open = board.size * board.size - board.walls.length;
  const shortest = board.pairs.reduce((sum, _, k) => sum + shortestJoin(board, k) + 1, 0);
  return shortest < open;
}

/** The open ways out of a dot at the start: empty squares, or its own twin. */
export function exitsOf(board: Board, dot: number): number[] {
  const dots = dotSet(board);
  const walls = new Set(board.walls);
  const k = board.pairs.findIndex((p) => p.includes(dot));
  const twin = board.pairs[k][0] === dot ? board.pairs[k][1] : board.pairs[k][0];
  return neighbours(dot, board.size).filter((nb) => nb === twin || (!dots.has(nb) && !walls.has(nb)));
}

/** A dot with exactly one way out, so its first step is forced. */
export const hasForcedStart = (board: Board) => board.pairs.flat().some((dot) => exitsOf(board, dot).length === 1);

/** The answer runs at least four squares along the edge of the board in one line. */
export function hasEdgeRun(board: Board): boolean {
  return board.solution.some((line) => {
    let run = 0;
    for (const cell of line) {
      run = onEdge(cell, board.size) ? run + 1 : 0;
      if (run >= 4) return true;
    }
    return false;
  });
}

/**
 * A first step that heads straight for the twin — the move a child is drawn
 * to — and leaves the board with no answer at all.
 */
export function trapMoves(board: Board): Array<{ dot: number; step: number }> {
  const out: Array<{ dot: number; step: number }> = [];
  board.pairs.forEach(([a, b], k) => {
    for (const [dot, twin] of [[a, b], [b, a]] as const) {
      for (const step of exitsOf(board, dot)) {
        if (step === twin) continue;
        if (manhattan(step, twin, board.size) >= manhattan(dot, twin, board.size)) continue;
        const pairs = board.pairs.map((p, j) => (j === k ? [dot, twin] : p)) as Array<[number, number]>;
        const prefix = pairs.map((p, j) => (j === k ? [dot, step] : [p[0]]));
        const result = solve({ size: board.size, walls: board.walls, pairs, prefix }, 1);
        if (!result.capped && result.count === 0) out.push({ dot, step });
      }
    }
  });
  return out;
}

export function hasFeature(board: Board, feature: Feature): boolean {
  switch (feature) {
    case "detour": return hasDetour(board);
    case "gap": return hasGap(board);
    case "forced-start": return hasForcedStart(board);
    case "edge": return hasEdgeRun(board);
    case "trap": return trapMoves(board).length > 0;
  }
}
