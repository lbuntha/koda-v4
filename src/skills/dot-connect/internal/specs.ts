import type { BoardSpec } from "./types";

/**
 * Generation parameters for every board lesson in the plan's lesson map.
 *
 * Kept beside the generator so Phase 0 can prove the invariants for every
 * lesson before any engine exists. Practice lessons draw from these by id.
 */
export const BOARD_SPECS: BoardSpec[] = [
  { id: "one-pair", size: 3, pairs: 1, mustFill: false },
  { id: "two-pairs", size: 4, pairs: 2, mustFill: false },
  { id: "go-around", size: 4, pairs: 3, mustFill: false, feature: "detour" },
  { id: "fill-every-square", size: 4, pairs: 3, mustFill: true, feature: "gap", difficulty: [0, 6] },

  { id: "one-way-out", size: 5, pairs: 4, mustFill: true, feature: "forced-start", difficulty: [0, 10] },
  { id: "hug-the-edge", size: 5, pairs: 4, mustFill: true, feature: "edge", difficulty: [2, 14] },
  { id: "dont-box-it-in", size: 6, pairs: 5, mustFill: true, feature: "trap", difficulty: [6, 40] },
  { id: "five-pairs", size: 6, pairs: 5, mustFill: true, difficulty: [8, 60] },

  { id: "big-board", size: 7, pairs: 6, mustFill: true, difficulty: [12, 90] },
  { id: "walls", size: 6, pairs: 4, mustFill: true, walls: 3, difficulty: [6, 60] },
  { id: "exact-steps", size: 5, pairs: 4, mustFill: true, steps: true, difficulty: [0, 40] },
  { id: "bridges", size: 5, pairs: 4, mustFill: true, bridge: true, difficulty: [0, 40] },
  { id: "on-your-own", size: 7, pairs: 7, mustFill: true, difficulty: [12, 120] },
];

/** Which boards each practice lesson mixes. */
export const PRACTICE_SPECS: Record<string, string[]> = {
  "practice-joining": ["two-pairs", "go-around", "fill-every-square"],
  "practice-planning": ["one-way-out", "hug-the-edge", "dont-box-it-in", "five-pairs"],
  "practice-dot-connect": ["big-board", "walls", "exact-steps", "bridges", "on-your-own"],
};

export const specFor = (id: string): BoardSpec | undefined => BOARD_SPECS.find((s) => s.id === id);
