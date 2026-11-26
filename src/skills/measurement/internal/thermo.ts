/**
 * Questions for Thermometer.
 *
 *   read      0–40 °C; the mark step cycles 1 → 2 → 5 over a round
 *   negative  −20 to 30 °C, read below zero
 *   change    "It was 4 °C. It got 7 degrees colder." Crossing 0 often.
 *   read_f    0–110 °F in 2s (US)
 *
 * Pure. Temperatures are whole degrees on a mark of the thermometer drawn.
 */

export type ThermoMode = "read" | "negative" | "change" | "read_f";
export const THERMO_MODES: readonly ThermoMode[] = ["read", "negative", "change", "read_f"];

export interface ThermoScale {
  unit: "C" | "F";
  min: number;
  max: number;
  step: number;
  labelEvery: number;
}

export interface ThermoQuestion {
  mode: ThermoMode;
  scale: ThermoScale;
  /** The temperature shown (for `change`, the start). */
  value: number;
  /** change: how many degrees, and which way. */
  change?: { by: number; dir: "warmer" | "colder" };
  answer: number;
}

export interface ThermoSetup {
  mode?: ThermoMode;
  modes?: ThermoMode[];
  questionsPerRound?: number;
  practice?: boolean;
}

const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** `read` gets harder over a round: marks of 1, then 2, then 5. */
export const READ_SCALES: readonly ThermoScale[] = [
  { unit: "C", min: 10, max: 30, step: 1, labelEvery: 5 },
  { unit: "C", min: 0, max: 40, step: 2, labelEvery: 10 },
  { unit: "C", min: 0, max: 40, step: 5, labelEvery: 10 },
];
export const NEGATIVE_SCALE: ThermoScale = { unit: "C", min: -20, max: 30, step: 2, labelEvery: 10 };
/** Changes are any whole number of degrees, so the change thermometer is marked in 1s. */
export const CHANGE_SCALE: ThermoScale = { unit: "C", min: -20, max: 30, step: 1, labelEvery: 5 };
export const FAHRENHEIT_SCALE: ThermoScale = { unit: "F", min: 0, max: 110, step: 2, labelEvery: 10 };

/** A temperature on a mark and not on a number (so it has to be read), strictly inside the scale. */
function onMark(s: ThermoScale, rand: () => number, lo = s.min, hi = s.max): number {
  const first = Math.ceil((lo - s.min) / s.step) + 1;
  const last = Math.floor((hi - s.min) / s.step) - 1;
  for (;;) {
    const v = s.min + randInt(first, last, rand) * s.step;
    if (v % s.labelEvery !== 0) return v;
  }
}

const keyOf = (q: ThermoQuestion) => `${q.mode}:${q.scale.step}:${q.value}:${q.change?.by ?? ""}${q.change?.dir ?? ""}`;

export function buildThermo(_setup: ThermoSetup, mode: ThermoMode, index: number, seen: Set<string>, rand: () => number = Math.random): ThermoQuestion {
  let q = draw(mode, index, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(mode, index, rand);
  seen.add(keyOf(q));
  return q;
}

function draw(mode: ThermoMode, index: number, rand: () => number): ThermoQuestion {
  switch (mode) {
    case "read": {
      // Questions 1–2 in 1s, 3–4 in 2s, 5+ in 5s.
      const scale = READ_SCALES[Math.min(2, Math.floor((index - 1) / 2))];
      const value = onMark(scale, rand);
      return { mode, scale, value, answer: value };
    }
    case "negative": {
      // Below zero most of the time: that is the new idea.
      const value = rand() < 0.75 ? onMark(NEGATIVE_SCALE, rand, -20, 0) : onMark(NEGATIVE_SCALE, rand, 0, 30);
      return { mode, scale: NEGATIVE_SCALE, value, answer: value };
    }
    case "change": {
      const scale = CHANGE_SCALE;
      for (;;) {
        const value = randInt(-15, 25, rand);
        const by = randInt(2, 25, rand);
        const dir = rand() < 0.5 ? "warmer" : "colder";
        const answer = dir === "warmer" ? value + by : value - by;
        // On the scale, and crossing 0 at least half the time.
        if (answer <= scale.min || answer >= scale.max) continue;
        if (Math.sign(answer) === Math.sign(value) && rand() < 0.6) continue;
        return { mode, scale, value, change: { by, dir }, answer };
      }
    }
    case "read_f": {
      const value = onMark(FAHRENHEIT_SCALE, rand);
      return { mode, scale: FAHRENHEIT_SCALE, value, answer: value };
    }
  }
}

/** Four choices; the sign slip (3 for −3) is always offered when the answer is below zero. */
export function thermoChoices(q: ThermoQuestion): number[] {
  const step = q.mode === "change" ? 1 : q.scale.step;
  const tricks: number[] = [];
  if (q.answer < 0) tricks.push(-q.answer);
  if (q.mode === "change") tricks.push(q.change!.dir === "warmer" ? q.value - q.change!.by : q.value + q.change!.by);
  const near = [1, -1, 2, -2, 3, -3].map((d) => q.answer + d * step);
  const out = [q.answer];
  for (const v of [...tricks, ...near]) {
    if (out.length === 4) break;
    if (v > q.scale.min - 1 && v < q.scale.max + 1 && !out.includes(v)) out.push(v);
  }
  return out;
}

/** "−3", with a true minus sign, so it never reads as a dash. */
export const degText = (v: number) => (v < 0 ? `−${-v}` : String(v));

export function thermoModeAt(setup: ThermoSetup, index: number): ThermoMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "read"];
  return cycle[(index - 1) % cycle.length];
}
