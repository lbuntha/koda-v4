/**
 * Questions for DialScale: reading a round scale's needle.
 *
 *   read      kitchen scale 0–1000 g, every mark numbered (each 100 g)
 *   interval  unnumbered small marks; the child works out what one step is
 *   read_kg   bathroom 0–60 kg (marks of 1, numbers every 10) or luggage 0–20 kg in halves
 *   read_lb   0–2 lb kitchen scale in ounces (16 oz = 1 lb)
 *
 * Pure. All values are whole numbers of the dial's smallest step, stored in
 * "units" (g, half-kg or oz), so every needle points exactly at a mark.
 */

export type ScaleMode = "read" | "interval" | "read_kg" | "read_lb";
export const SCALE_MODES: readonly ScaleMode[] = ["read", "interval", "read_kg", "read_lb"];

export interface Dial {
  /** What a value means: grams, kilograms (maybe in halves) or ounces. */
  unit: "g" | "kg" | "oz";
  /** In `unit`s (halves allowed only for kg). */
  max: number;
  step: number;
  labelEvery: number;
}

export interface ScaleQuestion {
  mode: ScaleMode;
  dial: Dial;
  /** What sits on the scale: drawn, never asked about. */
  load: ScaleLoad;
  value: number;
}

export type ScaleLoad = "flour" | "apples" | "rice" | "child" | "suitcase" | "carrots";

export interface ScaleSetup {
  mode?: ScaleMode;
  modes?: ScaleMode[];
  questionsPerRound?: number;
  practice?: boolean;
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** Kitchen dials for `interval`: unnumbered marks between numbers (plan: steps 2–250). */
export const INTERVAL_DIALS: readonly Dial[] = [
  { unit: "g", max: 20, step: 2, labelEvery: 10 },
  { unit: "g", max: 100, step: 5, labelEvery: 20 },
  { unit: "g", max: 200, step: 10, labelEvery: 50 },
  { unit: "g", max: 400, step: 20, labelEvery: 100 },
  { unit: "g", max: 500, step: 25, labelEvery: 100 },
  { unit: "g", max: 1000, step: 50, labelEvery: 200 },
  { unit: "g", max: 2000, step: 100, labelEvery: 500 },
  { unit: "g", max: 5000, step: 250, labelEvery: 1000 },
];
export const KITCHEN: Dial = { unit: "g", max: 1000, step: 100, labelEvery: 100 };
export const BATHROOM: Dial = { unit: "kg", max: 60, step: 1, labelEvery: 10 };
export const LUGGAGE: Dial = { unit: "kg", max: 20, step: 0.5, labelEvery: 5 };
export const POUNDS: Dial = { unit: "oz", max: 32, step: 1, labelEvery: 16 };

/** Steps on a dial (a 0–1000 g dial in 50s has 20). */
export const stepsOf = (d: Dial) => Math.round(d.max / d.step);

const keyOf = (q: ScaleQuestion) => `${q.mode}:${q.dial.max}:${q.dial.step}:${q.value}`;

export function buildScale(_setup: ScaleSetup, mode: ScaleMode, seen: Set<string>, rand: () => number = Math.random): ScaleQuestion {
  let q = draw(mode, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(mode, rand);
  seen.add(keyOf(q));
  return q;
}

/** A value on a mark of `dial`, never 0 or the end; with `offLabel`, never on a numbered mark. */
function onMark(dial: Dial, rand: () => number, offLabel: boolean): number {
  const n = stepsOf(dial);
  for (;;) {
    const k = randInt(1, n - 1, rand);
    const v = k * dial.step;
    if (!offLabel || Math.abs(v / dial.labelEvery - Math.round(v / dial.labelEvery)) > 1e-9) return v;
  }
}

function draw(mode: ScaleMode, rand: () => number): ScaleQuestion {
  switch (mode) {
    case "read":
      return { mode, dial: KITCHEN, load: pick(["flour", "apples", "carrots"] as const, rand), value: onMark(KITCHEN, rand, false) };
    case "interval": {
      const dial = pick(INTERVAL_DIALS, rand);
      return { mode, dial, load: pick(["flour", "apples", "rice", "carrots"] as const, rand), value: onMark(dial, rand, true) };
    }
    case "read_kg": {
      const luggage = rand() < 0.5;
      const dial = luggage ? LUGGAGE : BATHROOM;
      // Bathroom: a child weighs 15–55 kg. Luggage: always a half, so the halves are read.
      const value = luggage ? randInt(2, 18, rand) + 0.5 : randInt(15, 55, rand);
      return { mode, dial, load: luggage ? "suitcase" : "child", value: value % 10 === 0 && !luggage ? value + 3 : value };
    }
    case "read_lb":
      return { mode, dial: POUNDS, load: pick(["flour", "apples", "carrots"] as const, rand), value: onMark(POUNDS, rand, true) };
  }
}

/** "7½" for halves, plain otherwise. */
export const halfText = (v: number) => (Number.isInteger(v) ? String(v) : `${Math.floor(v)}½`);

/** "1 lb 5 oz", "11 oz", "2 lb". */
export function lbOz(oz: number): string {
  const lb = Math.floor(oz / 16);
  const rest = oz % 16;
  if (!lb) return `${rest} oz`;
  return rest ? `${lb} lb ${rest} oz` : `${lb} lb`;
}

/**
 * Four values to choose from. The classic slip is always there: counting
 * unnumbered marks as 1s (the last number plus the number of marks), and one
 * step either side.
 */
export function scaleChoices(q: ScaleQuestion): number[] {
  const { step, labelEvery, max } = q.dial;
  const below = Math.floor(q.value / labelEvery + 1e-9) * labelEvery;
  const marks = Math.round((q.value - below) / step);
  const tricks = step !== 1 && q.mode !== "read" ? [below + marks] : [];
  const near = [1, -1, 2, -2, 3, -3].map((d) => q.value + d * step);
  const out = [q.value];
  for (const v of [...tricks, ...near]) {
    if (out.length === 4) break;
    if (v > 0 && v < max && !out.includes(v)) out.push(v);
  }
  return out;
}

export function scaleModeAt(setup: ScaleSetup, index: number): ScaleMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "read"];
  return cycle[(index - 1) % cycle.length];
}
