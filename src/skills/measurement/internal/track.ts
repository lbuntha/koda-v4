/**
 * Questions for UnitTrack: measuring with blocks laid end to end.
 *
 *   lay:       lay blocks along a thing until it is covered, then say how many.
 *   spot:      two rows measure the same thing; one has a gap or an overlap.
 *   unit_size: the same thing in small cubes and in long rods; which needs more?
 *
 * Pure. Lengths are whole cubes on a 10-cube track, so every row drawn is the
 * row described.
 */

export type TrackMode = "lay" | "spot" | "unit_size";
export const TRACK_MODES: readonly TrackMode[] = ["lay", "spot", "unit_size"];

/** The track is this many cubes long; nothing is longer. */
export const TRACK = 10;

export type TrackThing = "pencil" | "crayon" | "ribbon" | "straw";
export const TRACK_THINGS: readonly TrackThing[] = ["pencil", "crayon", "ribbon", "straw"];

/** A block in a drawn row: where it starts and how long it is, in cubes (may be fractional for a gap or overlap). */
export interface Block {
  at: number;
  len: number;
}

export interface TrackQuestion {
  mode: TrackMode;
  thing: TrackThing;
  /** The thing's length in cubes. */
  length: number;
  /** spot: the two rows, and which one is laid properly. */
  rows?: [Block[], Block[]];
  flaw?: "gap" | "overlap";
  /** unit_size: how many cubes one rod is, and whether the question asks for more or fewer. */
  rod?: number;
  ask?: "more" | "fewer";
  /** lay: the count; spot: "0" or "1" (the right row); unit_size: "cube" or "rod". */
  answer: string;
}

export interface TrackSetup {
  mode?: TrackMode;
  minLength?: number;
  maxLength?: number;
  questionsPerRound?: number;
  practice?: boolean;
  modes?: TrackMode[];
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** `n` blocks of length 1, end to end from 0. */
export const properRow = (n: number): Block[] => Array.from({ length: n }, (_, i) => ({ at: i, len: 1 }));

/**
 * A row that measures the same thing badly. With a gap, fewer blocks reach the
 * end (the count is too small); with an overlap, more blocks are needed (too big).
 */
export function flawedRow(length: number, flaw: "gap" | "overlap", rand: () => number): Block[] {
  if (flaw === "gap") {
    // length - 1 blocks with a half-cube gap after one of them, so the row still spans most of the thing.
    const n = length - 1;
    const gapAfter = randInt(0, n - 2, rand);
    return Array.from({ length: n }, (_, i) => ({ at: i + (i > gapAfter ? 0.5 : 0), len: 1 }));
  }
  // length + 1 blocks squeezed in, each overlapping the next, the last ending where the thing ends.
  const n = length + 1;
  const stride = (length - 1) / length;
  return Array.from({ length: n }, (_, i) => ({ at: i * stride, len: 1 }));
}

const keyOf = (q: TrackQuestion) => `${q.mode}:${q.thing}:${q.length}:${q.flaw ?? ""}:${q.rod ?? ""}:${q.ask ?? ""}:${q.answer}`;

export function buildTrack(setup: TrackSetup, mode: TrackMode, seen: Set<string>, rand: () => number = Math.random): TrackQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(setup, mode, rand);
  seen.add(keyOf(q));
  return q;
}

function draw(setup: TrackSetup, mode: TrackMode, rand: () => number): TrackQuestion {
  const thing = pick(TRACK_THINGS, rand);
  if (mode === "lay") {
    const length = randInt(setup.minLength ?? 2, Math.min(setup.maxLength ?? 9, TRACK - 1), rand);
    return { mode, thing, length, answer: String(length) };
  }
  if (mode === "spot") {
    // A gap needs at least 3 blocks to sit between; an overlap needs room for one more.
    const length = randInt(Math.max(3, setup.minLength ?? 3), Math.min(setup.maxLength ?? 8, TRACK - 2), rand);
    const flaw = rand() < 0.5 ? "gap" : "overlap";
    const good = rand() < 0.5 ? 0 : 1;
    const rows: [Block[], Block[]] = good === 0 ? [properRow(length), flawedRow(length, flaw, rand)] : [flawedRow(length, flaw, rand), properRow(length)];
    return { mode, thing, length, rows, flaw, answer: String(good) };
  }
  // unit_size: rod is 2 or 3 cubes; the thing is a whole number of rods.
  const rod = rand() < 0.5 ? 2 : 3;
  const rods = randInt(1, Math.floor(TRACK / rod) - (rod === 2 ? 1 : 0), rand);
  const ask = rand() < 0.5 ? "more" : "fewer";
  return { mode, thing, length: rods * rod, rod, ask, answer: ask === "more" ? "cube" : "rod" };
}

/** How many blocks a drawn row uses: what a child who counts that row would say. */
export const countOf = (row: Block[]): number => row.length;

/** Whether a row is laid end to end from 0 with no gap and no overlap. */
export const isProper = (row: Block[]): boolean => row.every((b, i) => Math.abs(b.at - i) < 1e-9 && b.len === 1);

export function trackModeAt(setup: TrackSetup, index: number): TrackMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "lay"];
  return cycle[(index - 1) % cycle.length];
}
