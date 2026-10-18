/**
 * One round, as a reducer.
 *
 * The screen sends events (a tick of the clock, an answer, a hint, a skip, the
 * next puzzle) and reads the state that comes back. There is no timer, no
 * random call and no storage in here: time arrives as a number of seconds on
 * whatever clock the caller keeps, and the Machine's whole plan for a puzzle is
 * drawn from a seed up front. That is what lets a test play a round to the
 * end in milliseconds, and what lets a rematch be the same round.
 */

import { matchAnswer } from "./answer";
import { hintFor, hintState, pointsFor, type Hint, type HintState } from "./hints";
import { adaptLevel, effectiveLevel, isLockedOut, planMachine, type MachineLevel, type MachinePlan, type PuzzleWinner } from "./machine";
import { makeRng } from "./rng";
import { addResult, decidePuzzle, emptyScore, type RoundScore } from "./scoring";
import type { RebusSettings } from "./settings";
import type { Puzzle } from "./types";

export interface RoundConfig {
  puzzles: readonly Puzzle[];
  settings: RebusSettings;
  /** The child's pick; "adaptive" follows how the round is going. */
  level: MachineLevel | "adaptive";
  seed: string | number;
}

/** The puzzle on screen. */
export interface PuzzleRun {
  puzzle: Puzzle;
  level: MachineLevel;
  plan: MachinePlan;
  startedAt: number;
  /** When the puzzle started, or the last hint was taken: the hint timer counts from here. */
  lastHintAt: number;
  hints: Hint[];
  /** Wrong answers typed, for the gentle nudge and the parent's report. */
  wrong: number;
}

export type OutcomeReason = "solved" | "machine" | "time" | "skipped";

/** What happened on one puzzle, kept for the reveal and the summary. */
export interface PuzzleOutcome {
  puzzle: Puzzle;
  winner: PuzzleWinner;
  reason: OutcomeReason;
  /** Points the winner took. */
  points: number;
  hintsUsed: number;
  wrong: number;
  /** Seconds the puzzle lasted. */
  seconds: number;
}

export interface RoundState {
  /** `playing` a puzzle, `revealed` its answer, or `done` with the round. */
  phase: "playing" | "revealed" | "done";
  config: RoundConfig;
  index: number;
  run: PuzzleRun;
  /** Where "adaptive" currently stands. */
  adaptive: MachineLevel;
  score: RoundScore;
  outcomes: PuzzleOutcome[];
  /** The puzzle just finished, while `revealed`. */
  last: PuzzleOutcome | null;
}

export type RoundEvent =
  | { type: "tick"; now: number }
  | { type: "answer"; text: string; now: number }
  | { type: "hint"; now: number }
  | { type: "skip"; now: number }
  | { type: "next"; now: number };

const MIDDLE: MachineLevel = 1;

const startRun = (config: RoundConfig, index: number, adaptive: MachineLevel, now: number): PuzzleRun => {
  const puzzle = config.puzzles[index];
  const level = effectiveLevel(config.settings.machineLock, config.level, adaptive);
  return {
    puzzle,
    level,
    plan: planMachine(level, puzzle.difficulty, makeRng(`${config.seed}:${index}`)),
    startedAt: now,
    lastHintAt: now,
    hints: [],
    wrong: 0,
  };
};

/** A round needs at least one puzzle; the caller shows "not enough puzzles" before getting here. */
export const startRound = (config: RoundConfig, now: number): RoundState => {
  if (config.puzzles.length === 0) throw new Error("A round needs at least one puzzle.");
  const adaptive = MIDDLE;
  return {
    phase: "playing",
    config,
    index: 0,
    run: startRun(config, 0, adaptive, now),
    adaptive,
    score: emptyScore(),
    outcomes: [],
    last: null,
  };
};

export const elapsedOf = (run: PuzzleRun, now: number): number => Math.max(0, now - run.startedAt);

const finish = (state: RoundState, winner: PuzzleWinner, reason: OutcomeReason, now: number): RoundState => {
  const { run, config } = state;
  const seconds = Math.min(elapsedOf(run, now), config.settings.puzzleLimitSec);
  const hintsUsed = run.hints.length;
  const outcome: PuzzleOutcome = {
    puzzle: run.puzzle,
    winner,
    reason,
    points: winner === "child" ? pointsFor(hintsUsed, config.settings) : winner === "machine" ? config.settings.machinePoints : 0,
    hintsUsed,
    wrong: run.wrong,
    seconds,
  };
  return {
    ...state,
    phase: "revealed",
    score: addResult(state.score, { winner, hintsUsed, seconds }, config.settings),
    adaptive: config.level === "adaptive" ? adaptLevel(state.adaptive, winner) : state.adaptive,
    outcomes: [...state.outcomes, outcome],
    last: outcome,
  };
};

/** The clock has run: the Machine got there first, or time is up. */
const settleClock = (state: RoundState, now: number): RoundState | null => {
  const { run, config } = state;
  const t = elapsedOf(run, now);
  const solvesAt = run.plan.solvesAt;
  if (solvesAt !== null && solvesAt <= config.settings.puzzleLimitSec && t >= solvesAt) return finish(state, "machine", "machine", now);
  if (t >= config.settings.puzzleLimitSec) return finish(state, "none", "time", now);
  return null;
};

export const reduceRound = (state: RoundState, event: RoundEvent): RoundState => {
  if (event.type === "next") {
    if (state.phase !== "revealed") return state;
    const index = state.index + 1;
    if (index >= state.config.puzzles.length) return { ...state, phase: "done" };
    return { ...state, phase: "playing", index, run: startRun(state.config, index, state.adaptive, event.now), last: null };
  }

  if (state.phase !== "playing") return state;
  const settled = settleClock(state, event.now);
  if (settled) return settled;

  switch (event.type) {
    case "tick":
      return state;
    case "skip":
      return finish(state, "none", "skipped", event.now);
    case "hint": {
      const status = hintStatus(state, event.now);
      if (status.state !== "ready") return state;
      const run = { ...state.run, hints: [...state.run.hints, hintFor(state.run.puzzle, status.rung)], lastHintAt: event.now };
      return { ...state, run };
    }
    case "answer": {
      if (!matchAnswer(state.run.puzzle, event.text).ok) {
        return event.text.trim() === "" ? state : { ...state, run: { ...state.run, wrong: state.run.wrong + 1 } };
      }
      const t = elapsedOf(state.run, event.now);
      const winner = decidePuzzle({ childSolvedAt: t, machineSolvesAt: state.run.plan.solvesAt, limit: state.config.settings.puzzleLimitSec });
      return finish(state, winner, winner === "child" ? "solved" : "machine", event.now);
    }
  }
};

/** Where the hint button stands right now. */
export const hintStatus = (state: RoundState, now: number): HintState =>
  hintState(state.config.settings, state.run.hints.length, state.run.lastHintAt, now);

/** Whether the Machine has just guessed wrong and is locked out, for the "your chance" cue. */
export const machineLockedOut = (state: RoundState, now: number): boolean => isLockedOut(state.run.plan, elapsedOf(state.run, now));

/** How far through its thinking the Machine is, 0–1, for its progress bar. */
export const machineProgress = (state: RoundState, now: number): number => {
  const first = state.run.plan.attempts[0].at;
  return Math.min(1, elapsedOf(state.run, now) / first);
};
