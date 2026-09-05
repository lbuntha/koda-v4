/**
 * Bottle Sort — the shapes the pure layer works in.
 *
 * Phase 0 of docs/BOTTLE_SORT_BUILD_PLAN.md: rules, generation and a solver,
 * with no React and nothing registered. A rack is data; every function that
 * changes one returns a new rack, so the solver can search without copying
 * defensively and a test can compare before and after.
 */

export type BottleMode =
  | "plain" | "capacity" | "locked" | "oneway" | "budget"
  | "hidden" | "numbered" | "fractions" | "pattern" | "linked";

export interface Bottle {
  /** How many segments it holds. Capacity is per bottle, not per rack. */
  cap: number;
  /** Bottom-first. `seg[seg.length - 1]` is the top, and the only pourable end. */
  seg: number[];
  /** Receives but never pours. */
  oneWay?: boolean;
  /** Corked until the bottle at this index is finished. */
  lockedBy?: number;
  /** Pouring into this bottle also fills the one at this index. */
  linkedTo?: number;
  /** How many segments are visible, bottom-first. Hidden rounds start below `seg.length`. */
  shown?: number;
}

export type Rack = readonly Bottle[];

export interface Pour {
  from: number;
  to: number;
}

/** The generation parameters for one lesson's racks. */
export interface RackSpec {
  id: string;
  mode: BottleMode;
  colours: number;
  /** Uniform capacity, or one per bottle when the lesson mixes them. */
  bottles: number;
  cap: number;
  caps?: number[];
  /** Legal pours applied to a solved rack. The solution is at most this long. */
  scramble: number;
  /** Index of a bottle that receives but never pours. */
  oneWay?: number;
  /** `{ tube }` is corked until `{ on }` is finished. */
  lock?: { tube: number; on: number };
  /** Two bottles that fill together. */
  linked?: [number, number];
  /** Segments below the top two start hidden. */
  hidden?: boolean;
  /** Solve within this many pours. */
  budget?: "minimum" | "minimum+2";
}

/** Every bottle holds one colour, or nothing. */
export const isBottleDone = (b: Bottle): boolean =>
  b.seg.length === 0 || (b.seg.length === b.cap && b.seg.every((c) => c === b.seg[0]));

export const isSolved = (rack: Rack): boolean => rack.every(isBottleDone);

/** The run of one colour at the pourable end. */
export function topRun(b: Bottle): { colour: number; n: number } {
  if (!b.seg.length) return { colour: -1, n: 0 };
  const colour = b.seg[b.seg.length - 1];
  let n = 0;
  for (let i = b.seg.length - 1; i >= 0 && b.seg[i] === colour; i -= 1) n += 1;
  return { colour, n };
}
