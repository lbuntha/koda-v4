/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Playing a puzzle: board, history, undo, moves, clock, hint, win.
 *
 * Liquid Sort, Goods Sort and Count Crates each hold this same machine — three undo
 * stacks, three timers, two byte-identical `formatTime`s and three spellings of one
 * success payload. None of it is about the puzzle; it is about *playing* one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PuzzleRules } from "./rules";
import { findHint } from "./solve";

export interface PuzzleSolveReport<Board> {
  /**
   * The board the learner finished with — the payload, always.
   *
   * The server re-checks that it still holds the level's material and that every piece
   * is home, so a claim of success is worth nothing without the board behind it. All
   * three existing puzzles already carry this rule in a comment; here it is the type.
   */
  selected: Board;
  details: {
    levelId: string;
    moveCount: number;
    seconds: number;
    stars: number;
    hintsUsed: number;
  };
}

export interface UsePuzzlePlayOptions<Board, Move> {
  rules: PuzzleRules<Board, Move>;
  /** The scrambled starting board. Changing it restarts the puzzle. */
  initialBoard: Board;
  levelId: string;
  /** Shortest known solution, from `certifyLadder`. Drives the star rating. */
  parMoves?: number;
  onSolved?: (report: PuzzleSolveReport<Board>) => void;
  /** Reported when the learner asks for help, so difficulty can be read honestly. */
  onHint?: (details: Record<string, unknown>) => void;
  /** Search budget for the hint. */
  hintBudget?: number;
}

export interface PuzzlePlay<Board, Move> {
  board: Board;
  moveCount: number;
  seconds: number;
  isWon: boolean;
  stars: number;
  canUndo: boolean;
  /** The suggested move, once asked for. Tap again to play it. */
  hint: Move | null;
  hintsUsed: number;
  /** Play a move. Ignored when the puzzle is finished. */
  play(move: Move): void;
  undo(): void;
  reset(): void;
  /** First call suggests a move; second plays it — the pattern both sort puzzles use. */
  requestHint(): void;
  /** Legal moves from here, so a board can grey out what cannot be done. */
  legalMoves: Move[];
}

/** mm:ss — the same clock the puzzles print today, written once. */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Stars from moves taken against the shortest known solution.
 *
 * Generous on purpose: a child who finishes has succeeded, and the rating is there to
 * invite a second, tidier attempt — not to withhold the win.
 */
export function starsFor(moveCount: number, parMoves?: number): number {
  if (!parMoves || parMoves <= 0) return 3;
  if (moveCount <= Math.ceil(parMoves * 1.25)) return 3;
  if (moveCount <= parMoves * 2) return 2;
  return 1;
}

export function usePuzzlePlay<Board, Move>({
  rules,
  initialBoard,
  levelId,
  parMoves,
  onSolved,
  onHint,
  hintBudget,
}: UsePuzzlePlayOptions<Board, Move>): PuzzlePlay<Board, Move> {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [history, setHistory] = useState<Board[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [hint, setHint] = useState<Move | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  // The win effect must fire exactly once per solve, and `onSolved` is usually an inline
  // arrow that changes identity every render — keeping it in a ref stops it from being an
  // effect dependency that re-reports the same win.
  const solvedRef = useRef(false);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  /** A fresh board — a new level, or Reset on this one. */
  const startFrom = useCallback((next: Board) => {
    setBoard(next);
    setHistory([]);
    setMoveCount(0);
    setSeconds(0);
    setIsWon(false);
    setHint(null);
    setHintsUsed(0);
    solvedRef.current = false;
  }, []);

  useEffect(() => {
    startFrom(initialBoard);
  }, [initialBoard, levelId, startFrom]);

  // Stops on the win rather than running until unmount, so the reported time is the
  // time spent solving and not the time the celebration sat on screen.
  useEffect(() => {
    if (isWon) return;
    const timer = setInterval(() => setSeconds(previous => previous + 1), 1000);
    return () => clearInterval(timer);
  }, [isWon, levelId]);

  const play = useCallback(
    (move: Move) => {
      if (solvedRef.current) return;
      setHistory(previous => [...previous, board]);
      const next = rules.apply(board, move);
      setBoard(next);
      setMoveCount(previous => previous + 1);
      setHint(null);

      if (rules.isSolved(next)) {
        solvedRef.current = true;
        setIsWon(true);
      }
    },
    [board, rules],
  );

  // Reported from an effect, not from `play`, so the numbers in the payload are the
  // committed ones — reading `moveCount` inside `play` would report the value from
  // before the winning move.
  useEffect(() => {
    if (!isWon) return;
    onSolvedRef.current?.({
      selected: board,
      details: {
        levelId,
        moveCount,
        seconds,
        stars: starsFor(moveCount, parMoves),
        hintsUsed,
      },
    });
    // Fires once, when `isWon` flips; the rest are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWon]);

  const undo = useCallback(() => {
    if (isWon) return;
    setHistory(previous => {
      if (previous.length === 0) return previous;
      setBoard(previous[previous.length - 1]);
      // Undo returns the move too, so the count stays a count of moves that still stand.
      setMoveCount(count => Math.max(0, count - 1));
      setHint(null);
      return previous.slice(0, -1);
    });
  }, [isWon]);

  const reset = useCallback(() => startFrom(initialBoard), [initialBoard, startFrom]);

  const requestHint = useCallback(() => {
    if (isWon) return;
    // Second tap plays the move already on offer — otherwise a child has to find the
    // suggested piece themselves, which is the part they were stuck on.
    if (hint) {
      play(hint);
      return;
    }
    const next = findHint(rules, board, { budget: hintBudget });
    if (!next) return;
    setHint(next);
    setHintsUsed(used => used + 1);
    onHint?.({ levelId, moveCount });
  }, [board, hint, hintBudget, isWon, levelId, moveCount, onHint, play, rules]);

  const legalMoves = useMemo(
    () => (isWon ? [] : rules.legalMoves(board)),
    [board, isWon, rules],
  );

  return {
    board,
    moveCount,
    seconds,
    isWon,
    stars: starsFor(moveCount, parMoves),
    canUndo: history.length > 0 && !isWon,
    hint,
    hintsUsed,
    play,
    undo,
    reset,
    requestHint,
    legalMoves,
  };
}
