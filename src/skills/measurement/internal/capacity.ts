/**
 * Questions for PourLab: which holds more (pour each into cups), how many cups,
 * read a measuring jug, fill a jug to a line, and US cups, pints, quarts and
 * gallons.
 *
 * Pure. Volumes are whole millilitres or whole cups; every value asked for is
 * a mark the jug actually has (plan §4 rule 1).
 */

export type CapacityMode = "pour" | "cups" | "jug" | "fill" | "customary";
export const CAPACITY_MODES: readonly CapacityMode[] = ["pour", "cups", "jug", "fill", "customary"];

/** `mug` is the cup things are poured into; it is drawn, never asked about. */
export type Vessel = "jar" | "bowl" | "bottle" | "mug" | "vase" | "pot";
/** Tall-and-thin or short-and-wide, the look that misleads. */
export const VESSEL_SHAPE: Record<Exclude<Vessel, "mug">, "tall" | "wide"> = {
  jar: "tall",
  bottle: "tall",
  vase: "tall",
  bowl: "wide",
  pot: "wide",
};
export const VESSELS = Object.keys(VESSEL_SHAPE) as Exclude<Vessel, "mug">[];

export type CustomaryUnit = "cup" | "pint" | "quart" | "gallon";
export const CUSTOMARY: readonly CustomaryUnit[] = ["cup", "pint", "quart", "gallon"];
/** US customary capacity in cups. 1 pt = 2 c, 1 qt = 2 pt, 1 gal = 4 qt. */
export const CUPS_IN: Record<CustomaryUnit, number> = { cup: 1, pint: 2, quart: 4, gallon: 16 };

export interface CapacityQuestion {
  mode: CapacityMode;
  vessels?: Vessel[];
  /** pour/cups: how many cups each vessel fills. */
  cups?: number[];
  /** jug/fill: millilitres in the jug, or the target line. */
  ml?: number;
  max?: number;
  step?: number;
  /** Every how many mL a mark carries a number. */
  labelEvery?: number;
  /** customary: "how many small fill one big" or "which holds more". */
  kind?: "howMany" | "which";
  big?: CustomaryUnit;
  small?: CustomaryUnit;
  answer: string;
}

export interface CapacitySetup {
  mode?: CapacityMode;
  minCups?: number;
  maxCups?: number;
  max?: number;
  step?: number;
  labelEvery?: number;
  /** jug/fill: a round that gets harder, one step per question in turn (100 → 50 → 25). */
  steps?: number[];
  questionsPerRound?: number;
  practice?: boolean;
  modes?: CapacityMode[];
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];
const randInt = (lo: number, hi: number, rand: () => number) => lo + Math.floor(rand() * (hi - lo + 1));

/** Steps a jug may have, so every reading lands on a mark. */
export const JUG_STEPS = [25, 50, 100, 200, 250] as const;

export function jugSpec(setup: CapacitySetup): { max: number; step: number; labelEvery: number } {
  const max = setup.max ?? 1000;
  const step = setup.step ?? 100;
  const labelEvery = setup.labelEvery ?? Math.max(step, 100);
  if (max % step !== 0 || labelEvery % step !== 0) throw new Error(`jug ${max}/${step}/${labelEvery}: marks must divide evenly`);
  return { max, step, labelEvery };
}

const keyOf = (q: CapacityQuestion) =>
  `${q.mode}:${q.vessels?.join("-") ?? ""}:${q.cups?.join("-") ?? ""}:${q.ml ?? ""}:${q.kind ?? ""}:${q.big ?? ""}:${q.small ?? ""}`;

export function buildCapacity(setup: CapacitySetup, mode: CapacityMode, seen: Set<string>, rand: () => number = Math.random): CapacityQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < 40 && seen.has(keyOf(q)); i += 1) q = draw(setup, mode, rand);
  seen.add(keyOf(q));
  return q;
}

/** customary facts a child is asked: big container, small container, how many. */
export const CUSTOMARY_FACTS: { big: CustomaryUnit; small: CustomaryUnit }[] = [
  { big: "pint", small: "cup" },
  { big: "quart", small: "pint" },
  { big: "quart", small: "cup" },
  { big: "gallon", small: "quart" },
  { big: "gallon", small: "pint" },
];

function draw(setup: CapacitySetup, mode: CapacityMode, rand: () => number): CapacityQuestion {
  const lo = setup.minCups ?? 2;
  const hi = setup.maxCups ?? 6;

  if (mode === "pour") {
    // One tall, one wide. The tall one holds less 60% of the time: looks mislead.
    const tall = pick(VESSELS.filter((v) => VESSEL_SHAPE[v] === "tall"), rand);
    const wide = pick(VESSELS.filter((v) => VESSEL_SHAPE[v] === "wide"), rand);
    let a = randInt(lo, hi, rand);
    let b = randInt(lo, hi, rand);
    while (a === b) b = randInt(lo, hi, rand);
    const [tallCups, wideCups] = rand() < 0.6 ? [Math.min(a, b), Math.max(a, b)] : [Math.max(a, b), Math.min(a, b)];
    const tallFirst = rand() < 0.5;
    const vessels = tallFirst ? [tall, wide] : [wide, tall];
    const cups = tallFirst ? [tallCups, wideCups] : [wideCups, tallCups];
    [a, b] = cups;
    return { mode, vessels, cups, answer: a > b ? "0" : "1" };
  }

  if (mode === "cups") {
    const n = randInt(setup.minCups ?? 2, setup.maxCups ?? 8, rand);
    return { mode, vessels: [pick(VESSELS, rand)], cups: [n], answer: String(n) };
  }

  if (mode === "jug" || mode === "fill") {
    const { max, step, labelEvery } = jugSpec(setup);
    const ml = randInt(1, max / step - 1, rand) * step;
    return { mode, ml, max, step, labelEvery, answer: String(ml) };
  }

  // customary
  if (rand() < 0.3) {
    const [x, y] = [...CUSTOMARY].sort(() => rand() - 0.5).slice(0, 2) as CustomaryUnit[];
    const bigger = CUPS_IN[x] > CUPS_IN[y] ? x : y;
    return { mode, kind: "which", big: x, small: y, answer: bigger };
  }
  const fact = pick(CUSTOMARY_FACTS, rand);
  return { mode, kind: "howMany", ...fact, answer: String(CUPS_IN[fact.big] / CUPS_IN[fact.small]) };
}

/** The four numbers offered for "how many cups / pints": real alternatives, never the same twice. */
export function customaryChoices(answer: number): number[] {
  const pool = [2, 4, 8, 16, 3, 6];
  return [answer, ...pool.filter((n) => n !== answer)].slice(0, 4).sort((x, y) => x - y);
}

export function capacityModeAt(setup: CapacitySetup, index: number): CapacityMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "pour"];
  return cycle[(index - 1) % cycle.length];
}
