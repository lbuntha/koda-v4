/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Sliding tiles — the whole puzzle, in one file.
 *
 * The point of this file is its length. Everything a player experiences — undo, the
 * clock, the hint, the stars, forty guaranteed-solvable levels, the win report the
 * server can verify — comes from `PuzzleRules` below plus the ladder at the bottom.
 * There is no canvas logic here and no React.
 *
 * It also exercises the half of the solver the sort puzzles never touch: a 4x4 board
 * is ~10^13 positions, far past what a breadth-first sweep can reach, so this supplies
 * `heuristic` and gets A* instead. That is the only line that decides it.
 */

import { PuzzleRules } from "../rules";
import { LadderLevel, makeLadder } from "../ladder";

/** `tiles[i]` is the tile sitting at grid position `i`; `0` is the gap. */
export interface TileBoard {
  size: number;
  tiles: number[];
}

export interface TileParams {
  size: number;
}

/** A move names the position whose tile slides into the gap. */
export type TileMove = number;

export function solvedTileBoard({ size }: TileParams): TileBoard {
  const tiles = Array.from({ length: size * size }, (_, index) => (index + 1) % (size * size));
  return { size, tiles };
}

export const slidingTileRules: PuzzleRules<TileBoard, TileMove> = {
  id: "sliding-tile",

  legalMoves(board) {
    const gap = board.tiles.indexOf(0);
    const row = Math.floor(gap / board.size);
    const column = gap % board.size;
    const moves: TileMove[] = [];
    if (row > 0) moves.push(gap - board.size);
    if (row < board.size - 1) moves.push(gap + board.size);
    if (column > 0) moves.push(gap - 1);
    if (column < board.size - 1) moves.push(gap + 1);
    return moves;
  },

  apply(board, move) {
    const gap = board.tiles.indexOf(0);
    const tiles = board.tiles.slice();
    tiles[gap] = tiles[move];
    tiles[move] = 0;
    return { size: board.size, tiles };
  },

  isSolved(board) {
    return board.tiles.every(
      (tile, index) => tile === (index + 1) % board.tiles.length,
    );
  },

  key(board) {
    return board.tiles.join(",");
  },

  invariants(board) {
    // Every tile exactly once. A scramble that duplicated or dropped one would still
    // look like a puzzle, and `certifyLadder` is what catches that.
    const counts: Record<string, number> = {};
    for (const tile of board.tiles) {
      if (tile === 0) continue;
      counts[`tile_${tile}`] = (counts[`tile_${tile}`] ?? 0) + 1;
    }
    return counts;
  },

  /**
   * Manhattan distance: how far every tile is from home, ignoring that they get in
   * each other's way. It can only ever under-estimate — no move fixes more than one
   * tile's distance by more than one — so A* still returns a shortest plan.
   */
  heuristic(board) {
    let total = 0;
    for (let position = 0; position < board.tiles.length; position++) {
      const tile = board.tiles[position];
      if (tile === 0) continue;
      const home = tile - 1;
      total +=
        Math.abs(Math.floor(position / board.size) - Math.floor(home / board.size)) +
        Math.abs((position % board.size) - (home % board.size));
    }
    return total;
  },

  describeMove(board, move) {
    return `Slide the ${board.tiles[move]}`;
  },
};

/**
 * The ladder. Each rung changes exactly one thing, so the strategy is learnable
 * rather than guessable: the grid grows, then the shuffle deepens within a grid.
 */
const LEVELS: LadderLevel<TileParams>[] = [
  { id: "st_1", title: "Level 1: Two Slides", blurb: "A 3x3 board, two tiles out of place.", tier: "beginner", params: { size: 3 }, scramble: 3 },
  { id: "st_2", title: "Level 2: Corner Shuffle", blurb: "Still 3x3, but the gap has further to travel.", tier: "beginner", params: { size: 3 }, scramble: 6 },
  { id: "st_3", title: "Level 3: Half Muddled", blurb: "Half the board is out of order — plan before you slide.", tier: "apprentice", params: { size: 3 }, scramble: 12 },
  { id: "st_4", title: "Level 4: Full Shuffle", blurb: "A properly mixed 3x3. Solve the top row first.", tier: "apprentice", params: { size: 3 }, scramble: 24 },
  { id: "st_5", title: "Level 5: Fifteen", blurb: "The classic 4x4 board, gently shuffled.", tier: "advanced", params: { size: 4 }, scramble: 14 },
  { id: "st_6", title: "Level 6: Deep Fifteen", blurb: "The same board, mixed twice as far.", tier: "advanced", params: { size: 4 }, scramble: 28 },
];

export const slidingTileLadder = makeLadder(LEVELS);
