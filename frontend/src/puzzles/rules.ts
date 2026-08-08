/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The contract a logic puzzle implements — and the only file a new puzzle has to
 * think hard about.
 *
 * Liquid Sort and Goods Sort each grew their own board state, undo stack, timer,
 * hint solver and win report, so the second puzzle cost as much as the first and a
 * third would cost as much again. Nothing in that machinery is actually about
 * bottles or shelves: it is all "what may I do from here", "does this finish it",
 * "have I seen this position before". Say those five things once and the solver,
 * the level generator, the certification test and the play shell all follow.
 *
 * `Board` must be treated as immutable — `apply` returns a new one. The solver and
 * the undo stack both keep references to old boards, so mutating in place corrupts
 * history that has already been handed out.
 */

export interface PuzzleRules<Board, Move> {
  /** Stable identity, e.g. "sliding-tile". Used by level ids and the generator seed. */
  id: string;

  /** Everything legal from this position. Empty means stuck — see `isSolved` first. */
  legalMoves(board: Board): Move[];

  /** The position after `move`. Must not mutate `board`. */
  apply(board: Board, move: Move): Board;

  /** The win condition, in one place — the shell, the solver and the test all read it here. */
  isSolved(board: Board): boolean;

  /**
   * Identity of a *position*, for the solver's visited set.
   *
   * Collapse symmetry here: in a sort puzzle two containers holding the same thing
   * are interchangeable, so sorting the contents before joining them cuts the search
   * space several times over on exactly the boards where it hurts. Two positions a
   * player would call "the same" must produce the same key.
   */
  key(board: Board): string;

  /**
   * What the board is made of, as counts — pieces by colour, tiles by face.
   *
   * Two jobs. It is the server's grading key: a submitted board is only a solve if it
   * still holds what the level started with, otherwise an emptied board grades as a
   * perfect sort. And it is how `certify` proves the generator did not create or
   * destroy material while scrambling.
   */
  invariants(board: Board): Record<string, number>;

  /**
   * Optional admissible estimate of moves remaining — never an over-estimate.
   *
   * With one, `solve` runs A* and copes with puzzles whose branching defeats a plain
   * breadth-first sweep (a 4x4 sliding tile is 10^13 positions). Without one it falls
   * back to breadth-first, then depth-first, which is what the sort puzzles want:
   * their solutions are 20-40 moves deep but almost any greedy route reaches a win.
   *
   * Over-estimating does not crash anything — it just stops the first move being
   * optimal, which for a hint is a fair trade. Under-estimating is always safe.
   */
  heuristic?(board: Board): number;

  /** Human-readable move, for the hint line: "move the 7 left". */
  describeMove?(board: Board, move: Move): string;
}

/** A move paired with the board it leads to — what `solve` returns a list of. */
export interface PlanStep<Board, Move> {
  move: Move;
  board: Board;
}
