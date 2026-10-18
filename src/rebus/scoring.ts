/**
 * Who wins a puzzle, and what a round adds up to.
 *
 * The race is decided by times alone: when the child answered right, when the
 * Machine would have. That keeps it deterministic and testable, and the same
 * rule is what the server applies in a group room (with real answer times).
 */

import { DEFAULT_POINT_RULES, pointsFor, type PointRules } from "./hints";
import type { PuzzleWinner } from "./machine";

export interface RaceInput {
  /** Seconds when the child answered correctly, or null if they did not (skipped or still wrong). */
  childSolvedAt: number | null;
  /** Seconds when the Machine answers correctly, or null if it never does. */
  machineSolvesAt: number | null;
  /** The owner's per-puzzle time limit, in seconds. */
  limit: number;
}

/** First correct answer within the limit wins; a tie goes to the child; nobody within the limit means nobody. */
export const decidePuzzle = ({ childSolvedAt, machineSolvesAt, limit }: RaceInput): PuzzleWinner => {
  const child = childSolvedAt !== null && childSolvedAt <= limit ? childSolvedAt : null;
  const machine = machineSolvesAt !== null && machineSolvesAt <= limit ? machineSolvesAt : null;
  if (child === null && machine === null) return "none";
  if (child === null) return "machine";
  if (machine === null) return "child";
  return child <= machine ? "child" : "machine";
};

export interface PuzzleResult {
  winner: PuzzleWinner;
  hintsUsed: number;
  /** Seconds the puzzle lasted. */
  seconds: number;
}

export interface RoundScore {
  child: number;
  machine: number;
  childWins: number;
  machineWins: number;
  solved: number;
  hintsUsed: number;
  totalSeconds: number;
  puzzles: number;
}

export const emptyScore = (): RoundScore => ({ child: 0, machine: 0, childWins: 0, machineWins: 0, solved: 0, hintsUsed: 0, totalSeconds: 0, puzzles: 0 });

export const addResult = (score: RoundScore, result: PuzzleResult, rules: PointRules = DEFAULT_POINT_RULES): RoundScore => ({
  child: score.child + (result.winner === "child" ? pointsFor(result.hintsUsed, rules) : 0),
  machine: score.machine + (result.winner === "machine" ? rules.machinePoints : 0),
  childWins: score.childWins + (result.winner === "child" ? 1 : 0),
  machineWins: score.machineWins + (result.winner === "machine" ? 1 : 0),
  solved: score.solved + (result.winner === "child" ? 1 : 0),
  hintsUsed: score.hintsUsed + result.hintsUsed,
  totalSeconds: score.totalSeconds + result.seconds,
  puzzles: score.puzzles + 1,
});

export type RoundOutcome = "child" | "machine" | "tie";

/** Who won the round on points. */
export const roundOutcome = (score: RoundScore): RoundOutcome => (score.child > score.machine ? "child" : score.child < score.machine ? "machine" : "tie");

export const averageSeconds = (score: RoundScore): number => (score.puzzles === 0 ? 0 : score.totalSeconds / score.puzzles);
