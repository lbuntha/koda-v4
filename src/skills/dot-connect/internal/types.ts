/**
 * A square board. Cells are numbered row-major: `cell = row * size + col`.
 *
 * `pairs[k]` holds colour k's two dots. `solution[k]` is one line for colour k
 * from `pairs[k][0]` to `pairs[k][1]`; it is kept for hints only — the win check
 * never compares against it, so any valid answer counts.
 */
export interface Board {
  size: number;
  walls: number[];
  pairs: Array<[number, number]>;
  solution: number[][];
  /**
   * Squares two lines may cross: one straight across, one straight down.
   * A line on a bridge goes straight over it, and a full board uses both ways.
   */
  bridges?: number[];
  /** One pair whose line must take exactly this many steps (squares moved). */
  steps?: { pair: number; steps: number };
}

/** A lesson feature the generator must be able to show on the board. */
export type Feature = "detour" | "gap" | "forced-start" | "edge" | "trap";

export interface BoardSpec {
  id: string;
  size: number;
  pairs: number;
  /** Solved only when every open square is covered. Implies a unique answer. */
  mustFill: boolean;
  walls?: number;
  feature?: Feature;
  /** Solver branch band, so a later lesson never deals an easier board than an earlier one. */
  difficulty?: [number, number];
  /** One pair carries a step count, and only that count makes the answer unique. */
  steps?: boolean;
  /** One bridge square that two lines cross. */
  bridge?: boolean;
}

/** What the generator hands back: the board, plus how it was found. */
export interface GeneratedBoard extends Board {
  specId: string;
  /** Solver branch count — 0 means every move was forced. */
  difficulty: number;
  /** Retries ran out; the board is valid but may lack the feature or be non-unique. */
  fallback: boolean;
}
