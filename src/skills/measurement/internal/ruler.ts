/**
 * Questions for RulerDesk: reading, placing and drawing with a ruler, a broken
 * ruler, differences, lengths on a number line, inches and millimetres.
 *
 * Pure. Every length is a whole number of the ruler's smallest step (`sub`
 * steps per unit), so the end of every thing sits exactly on a mark.
 *
 *   read                one thing laid from 0; how long?          cm, 2–14
 *   place               the thing starts off the ruler; move it to 0, then read
 *   draw                draw a line of a given length from 0      cm, 2–14
 *   offset              a broken ruler starting at 1–6            cm
 *   difference          two things from 0; how much longer?       cm, ≤ 14
 *   numberline          add on or cut off; tap where it lands     0–100 cm in 5s
 *   read_inch           whole inches on a 12-inch (1 ft) ruler    1–11 in
 *   read_inch_fraction  halves and quarters of an inch            0¼–5¾ in
 *   read_mm             millimetres on a 15 cm ruler              5–145 mm
 */

import type { TrackThing } from "./track";

export type RulerMode =
  | "read"
  | "place"
  | "draw"
  | "offset"
  | "difference"
  | "numberline"
  | "read_inch"
  | "read_inch_fraction"
  | "read_mm";
export const RULER_MODES: readonly RulerMode[] = [
  "read",
  "place",
  "draw",
  "offset",
  "difference",
  "numberline",
  "read_inch",
  "read_inch_fraction",
  "read_mm",
];

export type RulerThing = TrackThing;
export const RULER_THINGS: readonly RulerThing[] = ["pencil", "crayon", "ribbon", "straw"];

/** The ruler drawn: its unit, the number at its left mark, how many units long, and steps per unit. */
export interface RulerSpec {
  unit: "cm" | "in" | "mm";
  start: number;
  span: number;
  sub: number;
}

export interface RulerQuestion {
  mode: RulerMode;
  ruler: RulerSpec;
  thing: RulerThing;
  /** Where the thing starts and how long it is, both in steps (1/sub of a unit) from the ruler's left mark. */
  from: number;
  steps: number;
  /** difference: the second, shorter thing. */
  other?: { thing: RulerThing; steps: number };
  /** numberline: the starting length, the change, and whether it is added or cut off (cm). */
  line?: { start: number; change: number; op: "add" | "cut" };
  /** The answer as the child gives it: a number, or for inch fractions the length in quarters. */
  answer: number;
}

export interface RulerSetup {
  mode?: RulerMode;
  modes?: RulerMode[];
  min?: number;
  max?: number;
  questionsPerRound?: number;
  practice?: boolean;
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

export const CM_RULER: RulerSpec = { unit: "cm", start: 0, span: 15, sub: 2 };
export const INCH_RULER: RulerSpec = { unit: "in", start: 0, span: 12, sub: 4 };
export const INCH_FRACTION_RULER: RulerSpec = { unit: "in", start: 0, span: 6, sub: 4 };
/** mm reads off a cm ruler with ten steps a centimetre; the answer is in mm. */
export const MM_RULER: RulerSpec = { unit: "mm", start: 0, span: 15, sub: 10 };
export const NUMBER_LINE = { max: 100, step: 5, labelEvery: 10 } as const;

const keyOf = (q: RulerQuestion) =>
  `${q.mode}:${q.thing}:${q.ruler.start}:${q.from}:${q.steps}:${q.other?.steps ?? ""}:${q.line ? `${q.line.start}${q.line.op}${q.line.change}` : ""}`;

export function buildRuler(setup: RulerSetup, mode: RulerMode, seen: Set<string>, rand: () => number = Math.random): RulerQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(setup, mode, rand);
  seen.add(keyOf(q));
  return q;
}

function draw(setup: RulerSetup, mode: RulerMode, rand: () => number): RulerQuestion {
  const thing = pick(RULER_THINGS, rand);
  const cmLength = () => randInt(setup.min ?? 2, Math.min(setup.max ?? 14, 14), rand);

  switch (mode) {
    case "read":
    case "place":
    case "draw": {
      const cm = cmLength();
      return { mode, ruler: CM_RULER, thing, from: 0, steps: cm * CM_RULER.sub, answer: cm };
    }
    case "offset": {
      // The ruler's first number is 1–6 and the thing starts there; the end number is the trap.
      const start = randInt(1, 6, rand);
      const ruler = { ...CM_RULER, start, span: 12 };
      const cm = randInt(2, Math.min(setup.max ?? 10, ruler.span - 1), rand);
      return { mode, ruler, thing, from: 0, steps: cm * ruler.sub, answer: cm };
    }
    case "difference": {
      const a = randInt(4, 14, rand);
      const b = randInt(2, a - 1, rand);
      const other = pick(RULER_THINGS.filter((t) => t !== thing), rand);
      return { mode, ruler: CM_RULER, thing, from: 0, steps: a * CM_RULER.sub, other: { thing: other, steps: b * CM_RULER.sub }, answer: a - b };
    }
    case "numberline": {
      const { max, step } = NUMBER_LINE;
      const op = rand() < 0.5 ? "add" : "cut";
      // Lengths and changes are multiples of 5, the result lands on a mark between 5 and 100.
      const start = randInt(2, max / step - 2, rand) * step;
      const room = op === "add" ? (max - start) / step : start / step - 1;
      const change = randInt(1, Math.min(room, 10), rand) * step;
      const answer = op === "add" ? start + change : start - change;
      return { mode, ruler: { unit: "cm", start: 0, span: max, sub: 1 }, thing, from: 0, steps: 0, line: { start, change, op }, answer };
    }
    case "read_inch": {
      const inches = randInt(setup.min ?? 1, Math.min(setup.max ?? 11, 11), rand);
      return { mode, ruler: INCH_RULER, thing, from: 0, steps: inches * INCH_RULER.sub, answer: inches };
    }
    case "read_inch_fraction": {
      // A whole number of inches and a half or a quarter: never a whole inch.
      const whole = randInt(0, 5, rand);
      const quarter = randInt(1, 3, rand);
      const quarters = whole * 4 + quarter;
      return { mode, ruler: INCH_FRACTION_RULER, thing, from: 0, steps: quarters, answer: quarters };
    }
    case "read_mm": {
      // Mostly between centimetre marks, so the millimetres have to be read.
      let mm = randInt(setup.min ?? 5, Math.min(setup.max ?? 145, 145), rand);
      if (mm % 10 === 0 && rand() < 0.8) mm += randInt(1, 9, rand);
      mm = Math.min(mm, 149);
      return { mode, ruler: MM_RULER, thing, from: 0, steps: mm, answer: mm };
    }
  }
}

/** The number printed at a mark, `step` steps from the ruler's left end. */
export const numberAt = (ruler: RulerSpec, step: number): number => ruler.start + step / ruler.sub;

/** "3½", "¾", "5¼": an inch length in quarters, as a ruler reader says it. */
export function quartersText(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const frac = ["", "¼", "½", "¾"][quarters % 4];
  return whole === 0 ? frac || "0" : `${whole}${frac}`;
}

/**
 * Wrong answers that a real mistake gives, then near neighbours. Each mode's
 * classic error is always on offer: the end number on a broken ruler, either
 * length in a difference, ¼ for ¾ (reading from the wrong side), cm for mm.
 */
export function rulerChoices(q: RulerQuestion): number[] {
  const tricks: number[] = [];
  if (q.mode === "offset") tricks.push(q.ruler.start + q.answer);
  if (q.mode === "difference") tricks.push(q.steps / q.ruler.sub, q.other!.steps / q.ruler.sub);
  if (q.mode === "read_inch_fraction") {
    const whole = Math.floor(q.answer / 4);
    tricks.push(whole * 4 + (4 - (q.answer % 4)), q.answer + 4, q.answer - 4);
  }
  if (q.mode === "read_mm") tricks.push(q.answer + 10, q.answer - 10, q.answer + 1, q.answer - 1);
  const near = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map((d) => q.answer + d);
  // Nothing the ruler could not show: a choice past its end is ruled out without reading.
  const max = q.mode === "offset" ? q.ruler.start + q.ruler.span : q.mode === "read_mm" ? q.ruler.span * 10 : q.mode === "read_inch_fraction" ? q.ruler.span * 4 : q.ruler.span;
  const out: number[] = [q.answer];
  for (const v of [...tricks, ...near]) {
    if (out.length === 4) break;
    if (v > 0 && v <= max && !out.includes(v) && !(q.mode === "read_inch_fraction" && v % 4 === 0)) out.push(v);
  }
  return seededOrder(out, keyOf(q));
}

/** A fixed order for one question, so buttons never slide under a finger, and the answer is not always first. */
export function seededOrder<T>(xs: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 10000) / 10000;
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function rulerModeAt(setup: RulerSetup, index: number): RulerMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "read"];
  return cycle[(index - 1) % cycle.length];
}
