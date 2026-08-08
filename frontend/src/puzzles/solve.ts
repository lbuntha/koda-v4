/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One solver for every puzzle that implements `PuzzleRules`.
 *
 * This replaces two hand-written searches that failed in opposite directions.
 * Liquid Sort's first hint solver was breadth-first on a 1500-iteration budget and
 * returned nothing at all on 7 of 20 *solvable* levels, because its solutions are
 * 20-38 moves deep. Goods Sort answered that with a pile of greedy special cases,
 * which is a second algorithm to keep correct rather than a fix.
 *
 * The rule here: search order is a `heuristic` on the rules, never a separate
 * code path. A puzzle that can estimate its distance to the goal gets A*; one that
 * cannot gets breadth-first for the shallow wins and depth-first for the deep ones.
 *
 * The budget counts states *generated*, not expanded — generating is where the work
 * is (a key, a hash lookup, a board copy each), and a budget on expansions lets one
 * expansion of a wide board generate hundreds of them.
 */

import { PuzzleRules } from "./rules";

export interface SolveOptions {
  /** Maximum positions generated before giving up. */
  budget?: number;
}

const DEFAULT_BUDGET = 120_000;

interface SearchNode {
  key: string;
  parent: number;
  moveIndex: number;
  cost: number;
}

/**
 * A plan from `start` to a solved board, or `null` if none was found inside the budget.
 *
 * An empty array means the board is *already* solved — distinct from `null`, and the
 * two must not be conflated: the shell shows "done" for one and "no hint" for the other.
 */
export function solve<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  start: Board,
  options: SolveOptions = {},
): Move[] | null {
  if (rules.isSolved(start)) return [];
  const budget = options.budget ?? DEFAULT_BUDGET;

  return rules.heuristic
    ? bestFirst(rules, start, budget)
    : breadthFirst(rules, start, budget) ?? depthFirst(rules, start, budget);
}

/** The single next move a player should make, or `null` when there is nothing to suggest. */
export function findHint<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  board: Board,
  options: SolveOptions = {},
): Move | null {
  const plan = solve(rules, board, options);
  return plan && plan.length > 0 ? plan[0] : null;
}

/** Walk parent pointers back to the root, producing moves in play order. */
function reconstruct<Move>(nodes: SearchNode[], moves: Move[], from: number): Move[] {
  const plan: Move[] = [];
  for (let at = from; at > 0; at = nodes[at].parent) plan.push(moves[nodes[at].moveIndex]);
  return plan.reverse();
}

/** A* — for puzzles that supply `heuristic`. */
function bestFirst<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  start: Board,
  budget: number,
): Move[] | null {
  const nodes: SearchNode[] = [{ key: rules.key(start), parent: -1, moveIndex: -1, cost: 0 }];
  const boards: Board[] = [start];
  const moves: Move[] = [];
  const best = new Map<string, number>([[nodes[0].key, 0]]);
  const heap = new MinHeap();
  heap.push(0, rules.heuristic!(start));

  let generated = 1;
  while (heap.size > 0 && generated < budget) {
    const index = heap.pop()!;
    const board = boards[index];
    const cost = nodes[index].cost;

    // A cheaper route to this position was found after it was queued.
    if (cost > (best.get(nodes[index].key) ?? Infinity)) continue;

    for (const move of rules.legalMoves(board)) {
      const next = rules.apply(board, move);
      const key = rules.key(next);
      const nextCost = cost + 1;
      if (nextCost >= (best.get(key) ?? Infinity)) continue;

      best.set(key, nextCost);
      generated++;
      const moveIndex = moves.push(move) - 1;
      const nodeIndex = nodes.push({ key, parent: index, moveIndex, cost: nextCost }) - 1;
      boards.push(next);

      if (rules.isSolved(next)) return reconstruct(nodes, moves, nodeIndex);
      heap.push(nodeIndex, nextCost + rules.heuristic!(next));
      if (generated >= budget) break;
    }
  }
  return null;
}

/** Shortest plan, for puzzles whose wins are shallow. */
function breadthFirst<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  start: Board,
  budget: number,
): Move[] | null {
  const nodes: SearchNode[] = [{ key: rules.key(start), parent: -1, moveIndex: -1, cost: 0 }];
  const boards: Board[] = [start];
  const moves: Move[] = [];
  const visited = new Set<string>([nodes[0].key]);

  for (let head = 0; head < nodes.length && nodes.length < budget; head++) {
    const board = boards[head];
    for (const move of rules.legalMoves(board)) {
      const next = rules.apply(board, move);
      const key = rules.key(next);
      if (visited.has(key)) continue;
      visited.add(key);

      const moveIndex = moves.push(move) - 1;
      const nodeIndex =
        nodes.push({ key, parent: head, moveIndex, cost: nodes[head].cost + 1 }) - 1;
      boards.push(next);

      if (rules.isSolved(next)) return reconstruct(nodes, moves, nodeIndex);
      if (nodes.length >= budget) break;
    }
  }
  return null;
}

/**
 * *A* route rather than the shortest one — what a hint actually needs.
 *
 * Kept as the fallback because a deep solution is exactly the shape breadth-first
 * cannot reach: on the Liquid Sort levels where the old BFS budget expired, depth-first
 * reaches a solved state in 22-38 explored positions.
 */
function depthFirst<Board, Move>(
  rules: PuzzleRules<Board, Move>,
  start: Board,
  budget: number,
): Move[] | null {
  const nodes: SearchNode[] = [{ key: rules.key(start), parent: -1, moveIndex: -1, cost: 0 }];
  const boards: Board[] = [start];
  const moves: Move[] = [];
  const visited = new Set<string>([nodes[0].key]);
  const stack: number[] = [0];

  while (stack.length > 0 && nodes.length < budget) {
    const index = stack.pop()!;
    const board = boards[index];

    for (const move of rules.legalMoves(board)) {
      const next = rules.apply(board, move);
      const key = rules.key(next);
      if (visited.has(key)) continue;
      visited.add(key);

      const moveIndex = moves.push(move) - 1;
      const nodeIndex =
        nodes.push({ key, parent: index, moveIndex, cost: nodes[index].cost + 1 }) - 1;
      boards.push(next);

      if (rules.isSolved(next)) return reconstruct(nodes, moves, nodeIndex);
      stack.push(nodeIndex);
      if (nodes.length >= budget) break;
    }
  }
  return null;
}

/** Indices ordered by priority. Small and explicit so the solver has no dependencies. */
class MinHeap {
  private items: { index: number; priority: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(index: number, priority: number): void {
    this.items.push({ index, priority });
    let child = this.items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.items[parent].priority <= this.items[child].priority) break;
      [this.items[parent], this.items[child]] = [this.items[child], this.items[parent]];
      child = parent;
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
          smallest = left;
        }
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
          smallest = right;
        }
        if (smallest === parent) break;
        [this.items[parent], this.items[smallest]] = [this.items[smallest], this.items[parent]];
        parent = smallest;
      }
    }
    return top.index;
  }
}
