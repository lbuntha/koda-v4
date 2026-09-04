/**
 * Every number the Subtraction skill asks a child to work with.
 *
 * Subtraction has stricter shapes than addition: the minuend must not be below
 * the subtrahend, a count-back problem needs a small subtrahend, count-up needs
 * a small difference, and an exchange lesson must actually exchange in the
 * named column. Activities declare those constraints here instead of rolling
 * their own arithmetic.
 *
 * Random search is always bounded. After `ATTEMPTS` draws, a deterministic scan
 * either finds a legal question or throws an authoring error. A constraint is
 * never silently relaxed.
 */

const ATTEMPTS = 200;

export const randInt = (lo: number, hi: number): number =>
  hi <= lo ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));

export const pick = <T,>(items: readonly T[]): T => items[randInt(0, items.length - 1)];

export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty",
];

export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/* -------------------------------------------------------------------------- */
/* Place value and exchanges                                                   */
/* -------------------------------------------------------------------------- */

export type Place = "ones" | "tens" | "hundreds";

export interface Digits {
  ones: number;
  tens: number;
  hundreds: number;
}

export const digitsOf = (n: number): Digits => ({
  ones: Math.abs(n) % 10,
  tens: Math.floor(Math.abs(n) / 10) % 10,
  hundreds: Math.floor(Math.abs(n) / 100) % 10,
});

export interface ExchangeStep {
  from: Exclude<Place, "ones">;
  to: Exclude<Place, "hundreds">;
  /** True when one request had to pass through an empty intermediate column. */
  acrossZero: boolean;
}

const PLACES = ["ones", "tens", "hundreds"] as const;

/**
 * The exchanges the standard right-to-left subtraction process requires.
 *
 * `402 - 185` returns hundred→tens and tens→ones, both marked as one
 * across-zero chain. The working digits are mutated exactly as the physical
 * blocks are: one larger unit becomes ten of the next smaller unit, and value
 * is conserved at every step.
 */
export function exchangesIn(minuend: number, subtrahend: number): ExchangeStep[] {
  if (minuend < subtrahend || subtrahend < 0) {
    throw new RangeError("subtractionNumbers: exchanges require minuend >= subtrahend >= 0");
  }

  const aDigits = digitsOf(minuend);
  const bDigits = digitsOf(subtrahend);
  const top = [aDigits.ones, aDigits.tens, aDigits.hundreds];
  const bottom = [bDigits.ones, bDigits.tens, bDigits.hundreds];
  const steps: ExchangeStep[] = [];

  for (let column = 0; column < PLACES.length; column += 1) {
    if (top[column] < bottom[column]) {
      let donor = column + 1;
      while (donor < PLACES.length && top[donor] === 0) donor += 1;
      if (donor >= PLACES.length) {
        throw new RangeError("subtractionNumbers: exchange exceeds the hundreds column");
      }

      const acrossZero = donor - column > 1;
      top[donor] -= 1;
      for (let next = donor - 1; next >= column; next -= 1) {
        top[next] += 10;
        steps.push({
          from: PLACES[next + 1] as Exclude<Place, "ones">,
          to: PLACES[next] as Exclude<Place, "hundreds">,
          acrossZero,
        });
        // Pass one of the ten new units down again until the requested column.
        if (next > column) top[next] -= 1;
      }
    }
    top[column] -= bottom[column];
  }

  return steps;
}

export const isRegrouping = (minuend: number, subtrahend: number): boolean =>
  exchangesIn(minuend, subtrahend).length > 0;

export const crossesBoundary = (
  minuend: number,
  subtrahend: number,
  boundary: 10 | 100,
): boolean => {
  const difference = minuend - subtrahend;
  return difference >= 0 && Math.floor(minuend / boundary) > Math.floor(difference / boundary);
};

/* -------------------------------------------------------------------------- */
/* Differences                                                                 */
/* -------------------------------------------------------------------------- */

export type ExchangeMode = "never" | "ones" | "tens" | "both" | "across_zero" | "any";

export interface Difference {
  minuend: number;
  subtrahend: number;
  difference: number;
}

export interface DifferenceSpec {
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  exchange?: ExchangeMode;
  /** Both operands must be whole multiples of this unit. */
  multipleOf?: 10 | 100;
  /** The count-back shape: no more than three steps. */
  smallSubtrahend?: boolean;
  /** The count-up shape: the endpoints are no more than ten apart. */
  smallDifference?: boolean;
  /** The subtraction must cross at least one ten/hundred boundary. */
  crossBoundary?: 10 | 100;
  /** Excludes `a - a`; useful everywhere except the subtract-all rule. */
  excludeEqual?: boolean;
  /**
   * The removed part and the remaining part must differ. A fact family built
   * from equal parts writes the same two equations twice, so the four-fact
   * lesson needs this even though the arithmetic is sound.
   */
  distinctParts?: boolean;
  /** Last digits allowed for the subtrahend, e.g. 8 or 9 for compensation. */
  subtrahendEndsIn?: number[];
  /** Values either operand may not take. */
  exclude?: number[];
}

const rangesOf = (
  spec: DifferenceSpec,
): { minuend: [number, number]; subtrahend: [number, number] } => ({
  minuend: spec.minuendRange ?? [1, 20],
  subtrahend: spec.subtrahendRange ?? [0, 9],
});

const differenceOf = (minuend: number, subtrahend: number): Difference => ({
  minuend,
  subtrahend,
  difference: minuend - subtrahend,
});

/** Question identity. Operand order is deliberately retained. */
export const differenceKey = (value: Difference): string =>
  `${value.minuend}-${value.subtrahend}`;

export function satisfiesDifference(value: Difference, spec: DifferenceSpec = {}): boolean {
  const ranges = rangesOf(spec);
  // This skill's concrete and written models are H/T/O. Thousands belong to
  // the next place-value band rather than being silently squeezed into them.
  if (value.minuend > 999 || value.subtrahend > 999) return false;
  if (value.minuend < ranges.minuend[0] || value.minuend > ranges.minuend[1]) return false;
  if (value.subtrahend < ranges.subtrahend[0] || value.subtrahend > ranges.subtrahend[1]) return false;
  if (value.subtrahend < 0 || value.minuend < value.subtrahend) return false;
  if (value.difference !== value.minuend - value.subtrahend) return false;

  if (spec.differenceRange) {
    const [lo, hi] = spec.differenceRange;
    if (value.difference < lo || value.difference > hi) return false;
  }
  if (spec.excludeEqual && value.minuend === value.subtrahend) return false;
  if (spec.distinctParts && value.subtrahend === value.difference) return false;
  if (spec.smallSubtrahend && value.subtrahend > 3) return false;
  if (spec.smallDifference && value.difference > 10) return false;
  if (spec.multipleOf && (
    value.minuend % spec.multipleOf !== 0 || value.subtrahend % spec.multipleOf !== 0
  )) return false;
  if (spec.crossBoundary && !crossesBoundary(value.minuend, value.subtrahend, spec.crossBoundary)) {
    return false;
  }
  if (spec.subtrahendEndsIn && !spec.subtrahendEndsIn.includes(value.subtrahend % 10)) {
    return false;
  }
  if (spec.exclude && (
    spec.exclude.includes(value.minuend) || spec.exclude.includes(value.subtrahend)
  )) return false;

  const exchanges = exchangesIn(value.minuend, value.subtrahend);
  const toOnes = exchanges.some((step) => step.to === "ones");
  const toTens = exchanges.some((step) => step.to === "tens");
  const acrossZero = exchanges.some((step) => step.acrossZero);
  switch (spec.exchange) {
    case "never":
      return exchanges.length === 0;
    case "ones":
      return exchanges.length === 1 && toOnes;
    case "tens":
      return exchanges.length === 1 && toTens;
    case "both":
      return exchanges.length === 2 && toOnes && toTens && !acrossZero;
    case "across_zero":
      return acrossZero;
    default:
      return true;
  }
}

function proposeDifference(spec: DifferenceSpec): Difference {
  const ranges = rangesOf(spec);

  if (spec.multipleOf) {
    const unit = spec.multipleOf;
    const a = unit * randInt(
      Math.ceil(ranges.minuend[0] / unit),
      Math.floor(ranges.minuend[1] / unit),
    );
    const bHigh = Math.min(ranges.subtrahend[1], a);
    const b = unit * randInt(
      Math.ceil(ranges.subtrahend[0] / unit),
      Math.floor(bHigh / unit),
    );
    return differenceOf(a, b);
  }

  const minuend = randInt(ranges.minuend[0], ranges.minuend[1]);
  const bHigh = Math.min(ranges.subtrahend[1], minuend);
  let subtrahend = randInt(ranges.subtrahend[0], bHigh);

  if (spec.subtrahendEndsIn?.length) {
    const ending = pick(spec.subtrahendEndsIn);
    const candidate = subtrahend - (subtrahend % 10) + ending;
    if (candidate >= ranges.subtrahend[0] && candidate <= bHigh) subtrahend = candidate;
  }

  return differenceOf(minuend, subtrahend);
}

function scanForDifference(spec: DifferenceSpec): Difference | undefined {
  const ranges = rangesOf(spec);
  let steps = 0;
  for (let a = ranges.minuend[0]; a <= ranges.minuend[1]; a += 1) {
    const bHigh = Math.min(ranges.subtrahend[1], a);
    for (let b = ranges.subtrahend[0]; b <= bHigh; b += 1) {
      if ((steps += 1) > 1_250_000) return undefined;
      const candidate = differenceOf(a, b);
      if (satisfiesDifference(candidate, spec)) return candidate;
    }
  }
  return undefined;
}

export function drawDifference(spec: DifferenceSpec = {}): Difference {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const candidate = proposeDifference(spec);
    if (satisfiesDifference(candidate, spec)) return candidate;
  }
  const scanned = scanForDifference(spec);
  if (scanned) return scanned;
  throw new Error(`subtractionNumbers: no difference satisfies ${JSON.stringify(spec)}`);
}

export interface ConstantDifference extends Difference {
  offset: number;
  adjustedMinuend: number;
  adjustedSubtrahend: number;
}

/** Add the same amount to both operands so the subtrahend becomes friendly. */
export function drawConstantDifference(
  spec: DifferenceSpec = {},
  target: 10 | 100 = 10,
): ConstantDifference {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const value = drawDifference(spec);
    const remainder = value.subtrahend % target;
    if (remainder === 0) continue;
    const offset = target - remainder;
    return {
      ...value,
      offset,
      adjustedMinuend: value.minuend + offset,
      adjustedSubtrahend: value.subtrahend + offset,
    };
  }
  throw new Error(`subtractionNumbers: constant difference needs a non-multiple of ${target}`);
}

/** Nearest ten or hundred, halves upward. */
export const roundTo = (n: number, unit: 10 | 100): number => Math.round(n / unit) * unit;

/** A nonnegative difference whose operands are both worth rounding. */
export function drawRoundingDifference(digits: 2 | 3): Difference {
  const [lo, hi] = digits === 2 ? [11, 99] : [101, 999];
  const unit = digits === 2 ? 10 : 100;
  const worthRounding = (n: number) =>
    n % unit !== 0 && n % unit !== unit / 2 && (digits === 2 || n % 10 !== 0);
  /*
   * The estimate has to be worth making.
   *
   * Both operands rounding to the same place gives an estimate of zero: 297
   * minus 251 came out as "about 300 − 300", so the answer a child was marked
   * right for was "about 0" — for a difference of forty-six. An estimate that
   * far from the truth is not a rough answer, it is a wrong one, and it teaches
   * the opposite of what rounding is for.
   *
   * One whole unit apart is the smallest gap that survives rounding, so it is
   * the floor.
   */
  const usefulEstimate = (minuend: number, subtrahend: number) =>
    roundTo(minuend, unit) - roundTo(subtrahend, unit) >= unit;

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const minuend = randInt(lo, hi);
    const subtrahend = randInt(lo, minuend);
    if (worthRounding(minuend) && worthRounding(subtrahend) && usefulEstimate(minuend, subtrahend)) {
      return differenceOf(minuend, subtrahend);
    }
  }
  return digits === 2 ? differenceOf(83, 47) : differenceOf(782, 346);
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export type StoryKind =
  | "remove_result"
  | "remove_change"
  | "remove_start"
  | "compare_difference"
  | "compare_bigger"
  | "compare_smaller"
  | "multi_step";

export interface StorySpec {
  startRange?: [number, number];
  changeRange?: [number, number];
  resultRange?: [number, number];
  smallerRange?: [number, number];
  differenceRange?: [number, number];
}

export interface StoryStep {
  operation: "add" | "subtract";
  left: number;
  right: number;
  result: number;
}

export interface StoryNumbers {
  kind: StoryKind;
  /** Quantities stated by the sentence, in sentence order. */
  values: number[];
  answer: number;
  intermediate?: number;
  steps?: StoryStep[];
}

export function drawSubtractionStory(
  kind: StoryKind,
  spec: StorySpec = {},
): StoryNumbers {
  const startRange = spec.startRange ?? [5, 50];
  const changeRange = spec.changeRange ?? [1, 20];
  const resultRange = spec.resultRange ?? [1, 30];
  const smallerRange = spec.smallerRange ?? [2, 30];
  const gapRange = spec.differenceRange ?? [1, 15];

  switch (kind) {
    case "remove_change": {
      const start = randInt(startRange[0], startRange[1]);
      const result = randInt(Math.max(resultRange[0], 0), Math.min(resultRange[1], start - 1));
      return { kind, values: [start, result], answer: start - result };
    }
    case "remove_start": {
      const change = randInt(changeRange[0], changeRange[1]);
      const result = randInt(resultRange[0], resultRange[1]);
      return { kind, values: [change, result], answer: change + result };
    }
    case "compare_difference": {
      const smaller = randInt(smallerRange[0], smallerRange[1]);
      const gap = randInt(gapRange[0], gapRange[1]);
      return { kind, values: [smaller, smaller + gap], answer: gap };
    }
    case "compare_bigger": {
      const smaller = randInt(smallerRange[0], smallerRange[1]);
      const gap = randInt(gapRange[0], gapRange[1]);
      return { kind, values: [smaller, gap], answer: smaller + gap };
    }
    case "compare_smaller": {
      const smaller = randInt(smallerRange[0], smallerRange[1]);
      const gap = randInt(gapRange[0], gapRange[1]);
      return { kind, values: [smaller + gap, gap], answer: smaller };
    }
    case "multi_step": {
      const start = randInt(Math.max(startRange[0], 5), startRange[1]);
      const added = randInt(2, 15);
      const intermediate = start + added;
      const removed = randInt(1, Math.min(changeRange[1], intermediate));
      const answer = intermediate - removed;
      return {
        kind,
        values: [start, added, removed],
        intermediate,
        answer,
        steps: [
          { operation: "add", left: start, right: added, result: intermediate },
          { operation: "subtract", left: intermediate, right: removed, result: answer },
        ],
      };
    }
    case "remove_result":
    default: {
      const start = randInt(startRange[0], startRange[1]);
      const change = randInt(changeRange[0], Math.min(changeRange[1], start - 1));
      return { kind: "remove_result", values: [start, change], answer: start - change };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* No repeats inside a round                                                   */
/* -------------------------------------------------------------------------- */

export function withoutRepeat<T>(
  draw: () => T,
  key: (value: T) => string,
  seen: Set<string>,
): T {
  let value = draw();
  for (let i = 0; i < ATTEMPTS && seen.has(key(value)); i += 1) value = draw();
  seen.add(key(value));
  return value;
}
