/**
 * Questions for EstimateCards: the sensible unit, and the sensible amount.
 *
 *   choose_unit: "Which unit would you use to measure how long a bus is?" cm, m or km.
 *   benchmark:   "About how long is a bus? 12 m or 120 m?" Two answers ten times apart.
 *
 * Pure. Every object's size is a real, rounded size a child can picture
 * (a door is about 2 m), and the unit it is measured in is the one a school
 * would use. The wrong benchmark is always ten times too big or too small,
 * never a near miss: estimating is about the right size, not the right digit.
 */

export type LengthUnit = "cm" | "m" | "km";
export const LENGTH_UNITS: readonly LengthUnit[] = ["cm", "m", "km"];
export type EstimateUnit = LengthUnit | "g" | "kg" | "mL" | "L";
/** The units offered together: one quantity at a time. */
export const UNIT_SETS = { length: LENGTH_UNITS, mass: ["g", "kg"], capacity: ["mL", "L"] } as const;
export type EstimateQuantity = keyof typeof UNIT_SETS;

export type EstimateThing =
  | "key"
  | "pencil"
  | "phone"
  | "book"
  | "scissors"
  | "door"
  | "bed"
  | "car"
  | "bus"
  | "tree"
  | "walk"
  | "town"
  | "train"
  | "apple"
  | "egg"
  | "banana"
  | "letter"
  | "dog"
  | "bike"
  | "child"
  | "sofa"
  | "glass"
  | "mug"
  | "can"
  | "bath"
  | "bucket";

/** Size in the unit it is measured in. `how` picks the wording. */
export const ESTIMATE_THINGS: Record<EstimateThing, { size: number; unit: EstimateUnit; how: "long" | "tall" | "far" | "heavy" | "holds" }> = {
  key: { size: 6, unit: "cm", how: "long" },
  pencil: { size: 15, unit: "cm", how: "long" },
  phone: { size: 15, unit: "cm", how: "long" },
  book: { size: 25, unit: "cm", how: "long" },
  scissors: { size: 13, unit: "cm", how: "long" },
  door: { size: 2, unit: "m", how: "tall" },
  bed: { size: 2, unit: "m", how: "long" },
  car: { size: 4, unit: "m", how: "long" },
  bus: { size: 12, unit: "m", how: "long" },
  tree: { size: 10, unit: "m", how: "tall" },
  walk: { size: 2, unit: "km", how: "far" },
  town: { size: 20, unit: "km", how: "far" },
  train: { size: 300, unit: "km", how: "far" },
  apple: { size: 150, unit: "g", how: "heavy" },
  egg: { size: 60, unit: "g", how: "heavy" },
  banana: { size: 120, unit: "g", how: "heavy" },
  letter: { size: 20, unit: "g", how: "heavy" },
  dog: { size: 10, unit: "kg", how: "heavy" },
  bike: { size: 12, unit: "kg", how: "heavy" },
  child: { size: 25, unit: "kg", how: "heavy" },
  sofa: { size: 40, unit: "kg", how: "heavy" },
  glass: { size: 200, unit: "mL", how: "holds" },
  mug: { size: 300, unit: "mL", how: "holds" },
  can: { size: 330, unit: "mL", how: "holds" },
  bath: { size: 150, unit: "L", how: "holds" },
  bucket: { size: 10, unit: "L", how: "holds" },
};
export const quantityOf = (unit: EstimateUnit): EstimateQuantity =>
  (Object.keys(UNIT_SETS) as EstimateQuantity[]).find((k) => (UNIT_SETS[k] as readonly string[]).includes(unit))!;
export const ESTIMATE_LIST = Object.keys(ESTIMATE_THINGS) as EstimateThing[];

export type EstimateMode = "choose_unit" | "benchmark";
export const ESTIMATE_MODES: readonly EstimateMode[] = ["choose_unit", "benchmark"];

export interface EstimateQuestion {
  mode: EstimateMode;
  thing: EstimateThing;
  /** benchmark: the two amounts shown, in the thing's unit; the answer is the real one. */
  options?: [number, number];
  /** choose_unit: the units offered (one quantity's set). */
  units?: readonly EstimateUnit[];
  /** choose_unit: the unit id; benchmark: the right amount as a string. */
  answer: string;
}

export interface EstimateSetup {
  mode?: EstimateMode;
  /** choose_unit: which units; "mass_capacity" alternates g/kg with mL/L. Default length. */
  quantity?: EstimateQuantity | "mass_capacity";
  modes?: EstimateMode[];
  questionsPerRound?: number;
  practice?: boolean;
}

const pick = <T,>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];

/** The wrong amount: ten times too big, or ten times too small when that is still a whole number. */
export function tenfold(size: number, rand: () => number): number {
  const smaller = size / 10;
  return Number.isInteger(smaller) && smaller >= 1 && rand() < 0.5 ? smaller : size * 10;
}

export function buildEstimate(setup: EstimateSetup, mode: EstimateMode, seen: Set<string>, rand: () => number = Math.random): EstimateQuestion {
  let q = draw(setup, mode, rand);
  for (let i = 0; i < 40 && seen.has(`${q.mode}:${q.thing}`); i += 1) q = draw(setup, mode, rand);
  seen.add(`${q.mode}:${q.thing}`);
  return q;
}

function draw(setup: EstimateSetup, mode: EstimateMode, rand: () => number): EstimateQuestion {
  if (mode === "choose_unit") {
    const wanted = setup.quantity ?? "length";
    const quantity: EstimateQuantity = wanted === "mass_capacity" ? (rand() < 0.5 ? "mass" : "capacity") : wanted;
    const units = UNIT_SETS[quantity];
    // Each unit equally often, so no unit is the safe guess.
    const unit = pick(units, rand);
    const thing = pick(ESTIMATE_LIST.filter((t) => ESTIMATE_THINGS[t].unit === unit), rand);
    return { mode, thing, units, answer: unit };
  }
  // Benchmarks are lengths (plan L20).
  const thing = pick(ESTIMATE_LIST.filter((t) => quantityOf(ESTIMATE_THINGS[t].unit) === "length"), rand);
  const { size } = ESTIMATE_THINGS[thing];
  const wrong = tenfold(size, rand);
  const options: [number, number] = rand() < 0.5 ? [size, wrong] : [wrong, size];
  return { mode, thing, options, answer: String(size) };
}

export function estimateModeAt(setup: EstimateSetup, index: number): EstimateMode {
  const cycle = setup.modes?.length ? setup.modes : [setup.mode ?? "choose_unit"];
  return cycle[(index - 1) % cycle.length];
}
