/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tower of Hanoi — a second puzzle, to prove the contract is not shaped around the first.
 *
 * Deliberately unlike sliding tiles in every way that could have leaked into the engine:
 * its board is ragged stacks rather than a fixed grid, its move is a pair rather than a
 * position, and it supplies **no `heuristic`** — so it takes the solver's breadth-first
 * path while sliding tiles takes A*. Neither file knows which.
 */

import { PuzzleRules } from "../rules";
import { LadderLevel, makeLadder } from "../ladder";

/** Each peg is bottom-to-top; a disk is its size, so a peg must always descend. */
export interface HanoiBoard {
  pegs: number[][];
}

export interface HanoiParams {
  disks: number;
  pegs: number;
}

export interface HanoiMove {
  from: number;
  to: number;
}

/** Every disk stacked on the last peg — the goal, and the generator's anchor. */
export function solvedHanoiBoard({ disks, pegs }: HanoiParams): HanoiBoard {
  const board: number[][] = Array.from({ length: pegs }, () => []);
  for (let size = disks; size >= 1; size--) board[pegs - 1].push(size);
  return { pegs: board };
}

const top = (peg: number[]): number | undefined => peg[peg.length - 1];

export const hanoiRules: PuzzleRules<HanoiBoard, HanoiMove> = {
  id: "hanoi",

  legalMoves(board) {
    const moves: HanoiMove[] = [];
    for (let from = 0; from < board.pegs.length; from++) {
      const moving = top(board.pegs[from]);
      if (moving === undefined) continue;
      for (let to = 0; to < board.pegs.length; to++) {
        if (to === from) continue;
        const landing = top(board.pegs[to]);
        // The one rule of the game: never a bigger disk onto a smaller one.
        if (landing === undefined || landing > moving) moves.push({ from, to });
      }
    }
    return moves;
  },

  apply(board, { from, to }) {
    const pegs = board.pegs.map(peg => peg.slice());
    pegs[to].push(pegs[from].pop()!);
    return { pegs };
  },

  isSolved(board) {
    const last = board.pegs[board.pegs.length - 1];
    const total = board.pegs.reduce((sum, peg) => sum + peg.length, 0);
    return last.length === total;
  },

  key(board) {
    // Pegs are *not* interchangeable here — the goal names one of them — so unlike a
    // sort puzzle this key must keep their order.
    return board.pegs.map(peg => peg.join(",")).join("|");
  },

  invariants(board) {
    const counts: Record<string, number> = {};
    for (const peg of board.pegs) {
      for (const disk of peg) counts[`disk_${disk}`] = (counts[`disk_${disk}`] ?? 0) + 1;
    }
    return counts;
  },

  describeMove(board, { from, to }) {
    return `Move disk ${top(board.pegs[from])} to peg ${to + 1}`;
  },
};

/**
 * Note what the ramp is expressed as. Hanoi's state space is tiny (3^n), so a random
 * walk saturates and scramble depth stops meaning anything — certification caught two
 * rungs that had mixed *longer* and come out *easier* than the rung below. So each rung
 * states the shortest solution it must require and the generator searches seeds for a
 * board that delivers it. Sliding tiles needs none of this; its walk does not saturate.
 */
const LEVELS: LadderLevel<HanoiParams>[] = [
  { id: "th_1", title: "Level 1: Three Disks", blurb: "The smallest tower — learn the one rule.", tier: "beginner", params: { disks: 3, pegs: 3 }, scramble: 6, minSolution: 5 },
  { id: "th_2", title: "Level 2: Three, Mixed", blurb: "Same three disks, as far from home as they go.", tier: "beginner", params: { disks: 3, pegs: 3 }, scramble: 12, minSolution: 7 },
  { id: "th_3", title: "Level 3: Four Disks", blurb: "A fourth disk doubles the work.", tier: "apprentice", params: { disks: 4, pegs: 3 }, scramble: 16, minSolution: 12 },
  { id: "th_4", title: "Level 4: Four, Scattered", blurb: "Four disks, the whole tower rebuilt.", tier: "apprentice", params: { disks: 4, pegs: 3 }, scramble: 28, minSolution: 15 },
  { id: "th_5", title: "Level 5: Five Disks", blurb: "Five disks and three pegs — the full puzzle.", tier: "advanced", params: { disks: 5, pegs: 3 }, scramble: 60, minSolution: 24 },
];

export const hanoiLadder = makeLadder(LEVELS);
