/**
 * The Machine is arithmetic on a clock, not a model.
 *
 * Before a puzzle starts it decides when it will answer and whether it will be
 * right, from its level and the puzzle's difficulty. Nothing is asked of a
 * server, so a child on a poor connection plays the same opponent, and a
 * seeded round replays exactly. Group rooms reuse this for stand-in players.
 */

import { between, type Rng } from "./rng";
import type { Difficulty } from "./types";

/** 0 easy, 1 medium, 2 hard. */
export type MachineLevel = 0 | 1 | 2;

export const MACHINE_LEVELS: readonly MachineLevel[] = [0, 1, 2];
export const MACHINE_LEVEL_NAMES = ["Easy", "Medium", "Hard"] as const;

export const MACHINE = {
  /** Chance of a right answer on the first try. */
  accuracy: [0.55, 0.75, 0.9],
  /** Seconds it takes to first answer, before the puzzle's difficulty scales it. */
  delay: [
    [26, 48],
    [16, 32],
    [8, 18],
  ],
  /** After a wrong guess it is locked out this long, visibly, so a child can pounce. */
  lockoutSeconds: 3,
  /** A second try comes this many seconds after the first. */
  retryDelay: [6, 10],
  /** A second try is right this often. After it, the Machine is done guessing. */
  retryAccuracy: 0.9,
} as const;

export interface MachineAttempt {
  /** Seconds from the puzzle starting. */
  at: number;
  correct: boolean;
}

export interface MachinePlan {
  attempts: MachineAttempt[];
  /** When the Machine gets it right, or null if it never does. */
  solvesAt: number | null;
}

/** A harder puzzle takes it longer: 0.8× on an easy one, 1.2× on a hard one. */
export const difficultyScale = (difficulty: Difficulty): number => 0.8 + 0.2 * difficulty;

export const planMachine = (level: MachineLevel, difficulty: Difficulty, rng: Rng): MachinePlan => {
  const [min, max] = MACHINE.delay[level];
  const firstAt = between(rng, min, max) * difficultyScale(difficulty);
  const first: MachineAttempt = { at: firstAt, correct: rng() < MACHINE.accuracy[level] };
  if (first.correct) return { attempts: [first], solvesAt: first.at };

  const [retryMin, retryMax] = MACHINE.retryDelay;
  const retry: MachineAttempt = { at: firstAt + between(rng, retryMin, retryMax), correct: rng() < MACHINE.retryAccuracy };
  return { attempts: [first, retry], solvesAt: retry.correct ? retry.at : null };
};

/** Whether the Machine is locked out after a wrong guess at time `t`. */
export const isLockedOut = (plan: MachinePlan, t: number): boolean =>
  plan.attempts.some((a) => !a.correct && t >= a.at && t < a.at + MACHINE.lockoutSeconds);

export type PuzzleWinner = "child" | "machine" | "none";

/** One step up when the child wins, one down when the Machine does; clamped to the three levels. */
export const adaptLevel = (current: MachineLevel, winner: PuzzleWinner): MachineLevel => {
  const next = winner === "child" ? current + 1 : winner === "machine" ? current - 1 : current;
  return Math.max(0, Math.min(2, next)) as MachineLevel;
};

/**
 * The level a round plays at: the owner's lock if there is one, otherwise the
 * child's pick, with "adaptive" following `adaptive` as the round goes.
 */
export const effectiveLevel = (
  lock: "free" | MachineLevel,
  choice: MachineLevel | "adaptive",
  adaptive: MachineLevel,
): MachineLevel => (lock !== "free" ? lock : choice === "adaptive" ? adaptive : choice);
