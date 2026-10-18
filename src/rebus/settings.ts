/**
 * What the owner can set, and the limits that keep it playable.
 *
 * These live with the other system defaults on the server so an owner changes
 * them without a release. Whatever arrives from there is clamped here, so a
 * stale or hand-edited value can never produce a game with a 0 s hint timer or
 * a room of one.
 */

import type { MachineLevel } from "./machine";

export interface RebusSettings {
  /** Seconds before a hint unlocks, and again between hints. */
  hintDelaySec: number;
  /** Seconds a puzzle lasts before the answer is shown and nobody scores. */
  puzzleLimitSec: number;
  /** How many hints a puzzle offers (1 category, 2 letters, 3 the pieces). */
  hintRungs: 1 | 2 | 3;
  /** Most players in one group room. */
  maxPlayers: number;
  /** "free" lets the child pick the Machine's level; a number fixes it. */
  machineLock: "free" | MachineLevel;
  /** Letter tiles instead of a keyboard, for the youngest. */
  letterTiles: boolean;
  /** How many puzzles a round can have. */
  questionChoices: readonly number[];
  /** Points for a win with no hints: what a child and the Machine race for in a round. */
  pointsPerPuzzle: number;
  /** Taken off a win for each hint used (a win is never worth less than 1). */
  hintCost: number;
  /** What the Machine scores for a puzzle it wins. */
  machinePoints: number;
  /**
   * XP for a perfect round, or null to follow the deployment's "XP per level"
   * in Scoring & XP like lessons and books. Stars and their shares always come
   * from Scoring & XP.
   */
  xpPerRound: number | null;
}

export const SETTING_LIMITS = {
  hintDelaySec: { min: 3, max: 60 },
  puzzleLimitSec: { min: 30, max: 120 },
  maxPlayers: { min: 2, max: 6 },
  /** A round is 5 to 10 puzzles. */
  questions: { min: 5, max: 10 },
  pointsPerPuzzle: { min: 1, max: 10 },
  hintCost: { min: 0, max: 5 },
  machinePoints: { min: 1, max: 10 },
  xpPerRound: { min: 0, max: 200 },
} as const;

export const DEFAULT_SETTINGS: RebusSettings = {
  hintDelaySec: 15,
  puzzleLimitSec: 60,
  hintRungs: 3,
  maxPlayers: 4,
  machineLock: "free",
  letterTiles: false,
  questionChoices: [5, 7, 10],
  pointsPerPuzzle: 3,
  hintCost: 1,
  machinePoints: 3,
  xpPerRound: null,
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
};

/** Whatever the server sent, made into settings a game can run on. */
export const normalizeSettings = (raw: unknown): RebusSettings => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lock = r.machineLock;
  const choices = Array.isArray(r.questionChoices)
    ? [...new Set(r.questionChoices.map((n) => clampInt(n, SETTING_LIMITS.questions.min, SETTING_LIMITS.questions.max, 0)).filter((n) => n > 0))].sort((a, b) => a - b)
    : [];
  return {
    hintDelaySec: clampInt(r.hintDelaySec, SETTING_LIMITS.hintDelaySec.min, SETTING_LIMITS.hintDelaySec.max, DEFAULT_SETTINGS.hintDelaySec),
    puzzleLimitSec: clampInt(r.puzzleLimitSec, SETTING_LIMITS.puzzleLimitSec.min, SETTING_LIMITS.puzzleLimitSec.max, DEFAULT_SETTINGS.puzzleLimitSec),
    hintRungs: clampInt(r.hintRungs, 1, 3, DEFAULT_SETTINGS.hintRungs) as 1 | 2 | 3,
    maxPlayers: clampInt(r.maxPlayers, SETTING_LIMITS.maxPlayers.min, SETTING_LIMITS.maxPlayers.max, DEFAULT_SETTINGS.maxPlayers),
    machineLock: lock === 0 || lock === 1 || lock === 2 ? lock : "free",
    letterTiles: r.letterTiles === true,
    questionChoices: choices.length > 0 ? choices : DEFAULT_SETTINGS.questionChoices,
    pointsPerPuzzle: clampInt(r.pointsPerPuzzle, SETTING_LIMITS.pointsPerPuzzle.min, SETTING_LIMITS.pointsPerPuzzle.max, DEFAULT_SETTINGS.pointsPerPuzzle),
    hintCost: clampInt(r.hintCost, SETTING_LIMITS.hintCost.min, SETTING_LIMITS.hintCost.max, DEFAULT_SETTINGS.hintCost),
    machinePoints: clampInt(r.machinePoints, SETTING_LIMITS.machinePoints.min, SETTING_LIMITS.machinePoints.max, DEFAULT_SETTINGS.machinePoints),
    // Anything that is not a number means "follow the deployment's XP", not zero XP.
    xpPerRound: typeof r.xpPerRound === "number" && Number.isFinite(r.xpPerRound) ? clampInt(r.xpPerRound, SETTING_LIMITS.xpPerRound.min, SETTING_LIMITS.xpPerRound.max, 0) : null,
  };
};
