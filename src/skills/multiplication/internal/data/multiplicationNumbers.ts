/**
 * Every number the Multiplication skill asks a child to work with.
 *
 * Multiplication's shapes are not addition's. An array has to fit on a phone,
 * a two-by-two area model is pointless if one of its four parts is zero, an
 * estimate is pointless if a factor is already round, and a "how many groups"
 * story is unanswerable unless the division comes out exactly. Activities
 * declare those constraints here rather than rolling their own arithmetic.
 *
 * Random search is always bounded. After `ATTEMPTS` draws a deterministic scan
 * either finds a legal question or throws an authoring error. A constraint is
 * never silently relaxed, because a relaxed constraint is a lesson quietly
 * teaching something else.
 */

const ATTEMPTS = 200;

/** What fits a 360px screen as a tappable grid, and the table's own ceiling. */
export const MAX_ARRAY_SIDE = 12;
export const MAX_ARRAY_CELLS = MAX_ARRAY_SIDE * MAX_ARRAY_SIDE;

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

/**
 * A number as a child hears it.
 *
 * Counting aloud is the point of the count-along, and "12" read by a speech
 * engine is not reliably "twelve". Past twenty the digits are read, which is
 * where the counting stops being one-at-a-time anyway.
 */
export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/* -------------------------------------------------------------------------- */
/* Place value                                                                 */
/* -------------------------------------------------------------------------- */

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

export const digitCount = (n: number): number => String(Math.abs(n)).length;

/**
 * A number as the place-value parts the area model cuts it into.
 *
 * `26` is twenty and six. `205` is two hundred and five — an empty column is
 * not a part, and drawing it as one would put a zero-wide rectangle in a model
 * whose whole job is that every piece has a size.
 */
export function placeValueSplit(n: number): number[] {
  const parts: number[] = [];
  let unit = 1;
  let rest = Math.abs(n);
  while (rest > 0) {
    const digit = rest % 10;
    if (digit > 0) parts.unshift(digit * unit);
    rest = Math.floor(rest / 10);
    unit *= 10;
  }
  return parts.length > 0 ? parts : [0];
}

/** True when every digit is nonzero, which is what gives an area model all its parts. */
export const hasNoZeroDigit = (n: number): boolean => !String(Math.abs(n)).includes("0");

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

export interface Product {
  a: number;
  b: number;
  product: number;
}

export interface ProductSpec {
  aRange?: [number, number];
  bRange?: [number, number];
  productMin?: number;
  productMax?: number;
  /** Zero and one are properties, taught at levels 7 and 6. Elsewhere they are noise. */
  allowZero?: boolean;
  allowOne?: boolean;
  /** `a × a` makes commutativity and the two-equation task vacuous. */
  distinctFactors?: boolean;
  /** Values either factor may not take. */
  exclude?: number[];
}

const productOf = (a: number, b: number): Product => ({ a, b, product: a * b });

/** Question identity where the two factors play different roles. */
export const productKey = (value: Product): string => `${value.a}x${value.b}`;

/**
 * Question identity where they do not.
 *
 * A recall round that asks 3 × 4 and then 4 × 3 has asked one fact twice. A
 * commutativity round that treats them as one has nothing left to teach. Both
 * keys exist so each mode can say which it means.
 */
export const factKey = (value: Product): string => {
  const [lo, hi] = value.a <= value.b ? [value.a, value.b] : [value.b, value.a];
  return `${lo}x${hi}`;
};

const productRanges = (spec: ProductSpec): { a: [number, number]; b: [number, number] } => ({
  a: spec.aRange ?? [2, 10],
  b: spec.bRange ?? [2, 10],
});

export function satisfiesProduct(value: Product, spec: ProductSpec = {}): boolean {
  const ranges = productRanges(spec);
  if (value.product !== value.a * value.b) return false;
  if (value.a < ranges.a[0] || value.a > ranges.a[1]) return false;
  if (value.b < ranges.b[0] || value.b > ranges.b[1]) return false;
  if (value.a < 0 || value.b < 0) return false;

  const usesZero = value.a === 0 || value.b === 0;
  const usesOne = value.a === 1 || value.b === 1;
  if (usesZero && !spec.allowZero) return false;
  if (usesOne && !spec.allowOne) return false;

  if (spec.distinctFactors && value.a === value.b) return false;
  if (spec.productMin !== undefined && value.product < spec.productMin) return false;
  if (spec.productMax !== undefined && value.product > spec.productMax) return false;
  if (spec.exclude && (spec.exclude.includes(value.a) || spec.exclude.includes(value.b))) {
    return false;
  }
  return true;
}

function scanForProduct(spec: ProductSpec): Product | undefined {
  const ranges = productRanges(spec);
  for (let a = ranges.a[0]; a <= ranges.a[1]; a += 1) {
    for (let b = ranges.b[0]; b <= ranges.b[1]; b += 1) {
      const candidate = productOf(a, b);
      if (satisfiesProduct(candidate, spec)) return candidate;
    }
  }
  return undefined;
}

export function drawProduct(spec: ProductSpec = {}): Product {
  const ranges = productRanges(spec);
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const candidate = productOf(
      randInt(ranges.a[0], ranges.a[1]),
      randInt(ranges.b[0], ranges.b[1]),
    );
    if (satisfiesProduct(candidate, spec)) return candidate;
  }
  const scanned = scanForProduct(spec);
  if (scanned) return scanned;
  throw new Error(`multiplicationNumbers: no product satisfies ${JSON.stringify(spec)}`);
}

/* -------------------------------------------------------------------------- */
/* Arrays                                                                      */
/* -------------------------------------------------------------------------- */

export interface ArrayShape {
  rows: number;
  cols: number;
  total: number;
}

export interface ArraySpec {
  rowRange?: [number, number];
  colRange?: [number, number];
  /** The apparatus ceiling. A spec that cannot fit is an authoring error, not a squeeze. */
  maxCells?: number;
  distinctSides?: boolean;
}

export function satisfiesArray(shape: ArrayShape, spec: ArraySpec = {}): boolean {
  const rows = spec.rowRange ?? [2, 10];
  const cols = spec.colRange ?? [2, 10];
  const maxCells = spec.maxCells ?? MAX_ARRAY_CELLS;
  if (shape.total !== shape.rows * shape.cols) return false;
  if (shape.rows < rows[0] || shape.rows > rows[1]) return false;
  if (shape.cols < cols[0] || shape.cols > cols[1]) return false;
  if (shape.rows > MAX_ARRAY_SIDE || shape.cols > MAX_ARRAY_SIDE) return false;
  if (shape.total > maxCells) return false;
  if (spec.distinctSides && shape.rows === shape.cols) return false;
  return true;
}

export function drawArray(spec: ArraySpec = {}): ArrayShape {
  const rows = spec.rowRange ?? [2, 10];
  const cols = spec.colRange ?? [2, 10];
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const r = randInt(rows[0], rows[1]);
    const c = randInt(cols[0], cols[1]);
    const shape = { rows: r, cols: c, total: r * c };
    if (satisfiesArray(shape, spec)) return shape;
  }
  for (let r = rows[0]; r <= rows[1]; r += 1) {
    for (let c = cols[0]; c <= cols[1]; c += 1) {
      const shape = { rows: r, cols: c, total: r * c };
      if (satisfiesArray(shape, spec)) return shape;
    }
  }
  throw new Error(`multiplicationNumbers: no array satisfies ${JSON.stringify(spec)}`);
}

export interface MissingDimension extends ArrayShape {
  unknown: "rows" | "cols";
  /** The side the child must supply. */
  answer: number;
}

/** Total and one side shown; the other side is the answer, and always comes out whole. */
export function drawMissingDimension(spec: ArraySpec = {}): MissingDimension {
  const shape = drawArray(spec);
  const unknown = randInt(0, 1) === 0 ? "rows" : "cols";
  return { ...shape, unknown, answer: unknown === "rows" ? shape.rows : shape.cols };
}

/* -------------------------------------------------------------------------- */
/* Hops along a line                                                           */
/* -------------------------------------------------------------------------- */

export interface HopRun {
  /** How long one hop is — the size of one equal group. */
  step: number;
  /** How many hops are made — the number of groups. `a × b` is `a` hops of `b`. */
  hops: number;
  /** Where the last hop lands: the product, and the reason a skip count exists. */
  landing: number;
}

export interface HopSpec {
  /**
   * The hop lengths this lesson counts in.
   *
   * A set rather than a range because the lengths a child skip counts in are
   * not contiguous — twos, threes, fours, fives and tens, with the sixes and
   * sevens left to the derived-fact ladder. `stepRange` covers the lessons that
   * do want every length.
   */
  steps?: number[];
  stepRange?: [number, number];
  hopRange?: [number, number];
  /** The far end of the line. A run past it cannot be drawn, so it is not drawn. */
  max?: number;
}

const valuesIn = ([lo, hi]: [number, number]): number[] =>
  Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

export const hopSteps = (spec: HopSpec): number[] =>
  spec.steps && spec.steps.length > 0 ? spec.steps : valuesIn(spec.stepRange ?? [2, 10]);

export function satisfiesHopRun(run: HopRun, spec: HopSpec = {}): boolean {
  const hops = spec.hopRange ?? [2, 10];
  const max = spec.max ?? 100;
  if (run.landing !== run.step * run.hops) return false;
  // A hop of one is counting, not skip counting; a single hop is not a run.
  if (run.step < 2 || run.hops < 2) return false;
  if (!hopSteps(spec).includes(run.step)) return false;
  if (run.hops < hops[0] || run.hops > hops[1]) return false;
  if (run.landing > max) return false;
  return true;
}

export function drawHopRun(spec: HopSpec = {}): HopRun {
  const steps = hopSteps(spec);
  const hops = spec.hopRange ?? [2, 10];
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const step = pick(steps);
    const count = randInt(hops[0], hops[1]);
    const run = { step, hops: count, landing: step * count };
    if (satisfiesHopRun(run, spec)) return run;
  }
  for (const step of steps) {
    for (let count = hops[0]; count <= hops[1]; count += 1) {
      const run = { step, hops: count, landing: step * count };
      if (satisfiesHopRun(run, spec)) return run;
    }
  }
  throw new Error(`multiplicationNumbers: no hop run satisfies ${JSON.stringify(spec)}`);
}

/** Two runs that land on the same number are one question, however they were drawn. */
export const hopKey = (run: HopRun): string => `${run.hops}h${run.step}`;

/* -------------------------------------------------------------------------- */
/* Multiples                                                                   */
/* -------------------------------------------------------------------------- */

export interface MultipleQuestion {
  step: number;
  value: number;
  isMultiple: boolean;
}

export interface MultipleSpec {
  /** One fixed hop length. */
  step?: number;
  /**
   * The lengths to draw from when the lesson wants a different one each time.
   *
   * A round that asks about the fives five times has asked one question five
   * times; spotting multiples is a skill across tables, not within one.
   */
  steps?: number[];
  max?: number;
  /**
   * How far a non-multiple may sit from a real one.
   *
   * Without this a wrong answer is spottable by size alone — "is 97 a multiple
   * of 10" is not a question about multiples. Near misses make it one.
   */
  nearMissDelta?: number;
}

export function drawMultipleQuestion(spec: MultipleSpec): MultipleQuestion {
  const step = spec.step ?? pick(spec.steps ?? [2, 3, 4, 5, 10]);
  if (step < 2) throw new RangeError("multiplicationNumbers: a multiple needs a step of 2 or more");
  const max = spec.max ?? 120;
  const delta = spec.nearMissDelta ?? 2;
  const highest = Math.floor(max / step);
  if (highest < 2) {
    throw new Error(`multiplicationNumbers: ${max} holds no multiples of ${step} to ask about`);
  }

  const wantMultiple = randInt(0, 1) === 0;
  const anchor = step * randInt(2, highest);
  if (wantMultiple) return { step, value: anchor, isMultiple: true };

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const offset = pick([-delta, -1, 1, delta].filter((d) => d !== 0));
    const candidate = anchor + offset;
    if (candidate > 0 && candidate <= max && candidate % step !== 0) {
      return { step, value: candidate, isMultiple: false };
    }
  }
  // Every near miss landed on another multiple, which only a step of 1 can do.
  return { step, value: anchor, isMultiple: true };
}

/* -------------------------------------------------------------------------- */
/* Splitting a factor                                                          */
/* -------------------------------------------------------------------------- */

export interface FactSplit {
  /** The factor being cut. */
  factor: number;
  /** The factor it is multiplied by; unchanged by the cut. */
  other: number;
  partA: number;
  partB: number;
  product: number;
}

/** The facts a child can be assumed to reach for when breaking a harder one apart. */
export const FRIENDLY_PARTS: readonly number[] = [2, 5, 10] as const;

/**
 * Cut one factor into a friendly part and the rest.
 *
 * `7 × 8` becomes `5 × 8` and `2 × 8`. The cut is never arbitrary: the first
 * part is a fact the child already owns, which is the entire point of the
 * distributive property at this age.
 */
export function drawFactSplit(spec: ProductSpec = {}): FactSplit {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const value = drawProduct(spec);
    const usable = FRIENDLY_PARTS.filter((part) => part < value.a);
    if (usable.length === 0) continue;
    const partA = pick(usable);
    return {
      factor: value.a,
      other: value.b,
      partA,
      partB: value.a - partA,
      product: value.product,
    };
  }
  throw new Error(
    `multiplicationNumbers: no factor in ${JSON.stringify(spec)} splits into a friendly part`,
  );
}

/* -------------------------------------------------------------------------- */
/* Area model and partial products                                             */
/* -------------------------------------------------------------------------- */

export interface PartialProduct {
  left: number;
  right: number;
  product: number;
}

/**
 * The rectangles an area model cuts `a × b` into.
 *
 * Both factors split by place value, then every pair. `23 × 46` gives
 * 20×40, 20×6, 3×40 and 3×6 — which sum to 1058, as the model claims.
 */
export function partialProductsOf(a: number, b: number): PartialProduct[] {
  const parts: PartialProduct[] = [];
  for (const left of placeValueSplit(a)) {
    for (const right of placeValueSplit(b)) {
      parts.push({ left, right, product: left * right });
    }
  }
  return parts;
}

export interface PartialProductSpec {
  digitsA?: 1 | 2 | 3;
  digitsB?: 1 | 2;
  /**
   * Every cross product must be nonzero.
   *
   * A zero digit collapses the four-part model to two and hides the structure
   * the lesson exists to show, while still marking the answer correct.
   */
  allPartsNonzero?: boolean;
}

const rangeForDigits = (digits: 1 | 2 | 3): [number, number] =>
  digits === 1 ? [2, 9] : digits === 2 ? [11, 99] : [101, 999];

export function drawPartialProduct(spec: PartialProductSpec = {}): Product {
  const digitsA = spec.digitsA ?? 2;
  const digitsB = spec.digitsB ?? 1;
  const [aLo, aHi] = rangeForDigits(digitsA);
  const [bLo, bHi] = rangeForDigits(digitsB);
  const wantsAllParts = spec.allPartsNonzero ?? true;

  const ok = (a: number, b: number): boolean => {
    if (digitCount(a) !== digitsA || digitCount(b) !== digitsB) return false;
    if (wantsAllParts && (!hasNoZeroDigit(a) || !hasNoZeroDigit(b))) return false;
    // A factor of one on either side makes the model a copy, not a product.
    return a > 1 && b > 1;
  };

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(aLo, aHi);
    const b = randInt(bLo, bHi);
    if (ok(a, b)) return productOf(a, b);
  }
  for (let a = aLo; a <= aHi; a += 1) {
    for (let b = bLo; b <= bHi; b += 1) {
      if (ok(a, b)) return productOf(a, b);
    }
  }
  throw new Error(
    `multiplicationNumbers: no partial product satisfies ${JSON.stringify(spec)}`,
  );
}

/* -------------------------------------------------------------------------- */
/* The written algorithm                                                       */
/* -------------------------------------------------------------------------- */

export type CarryMode = "never" | "some" | "any";

export interface ColumnSpec {
  digitsA?: 2 | 3;
  digitsB?: 1 | 2;
  carries?: CarryMode;
  /**
   * The multiplier must split into two nonzero parts.
   *
   * `46 × 30` has no ones row — its second row is the only row — so the
   * two-digit method has nothing to teach with it, and an engine that assumes
   * two partial rows has nothing to draw.
   */
  bNoZeroDigit?: boolean;
}

/** Every digit-by-digit product the written method asks for. */
export function digitProducts(a: number, b: number): number[] {
  const out: number[] = [];
  for (const left of String(Math.abs(a)).split("")) {
    for (const right of String(Math.abs(b)).split("")) {
      out.push(Number(left) * Number(right));
    }
  }
  return out;
}

/**
 * How many carries the written method actually records.
 *
 * Counted per partial row, right to left, exactly as a child writes them — a
 * carry created by the running total counts, which is why this is not simply
 * "some digit product exceeds nine".
 */
export function carriesIn(a: number, b: number): number {
  const topDigits = String(Math.abs(a)).split("").reverse().map(Number);
  const bottomDigits = String(Math.abs(b)).split("").reverse().map(Number);
  let count = 0;
  for (const multiplier of bottomDigits) {
    let carry = 0;
    for (const digit of topDigits) {
      const total = digit * multiplier + carry;
      carry = Math.floor(total / 10);
      if (carry > 0) count += 1;
    }
  }
  return count;
}

export interface ColumnStep {
  /** A digit written on the answer line, or a carry written above the next column. */
  kind: "digit" | "carry";
  /** The column it belongs in. */
  place: number;
  value: number;
}

/**
 * The written method, in the order a child performs it.
 *
 * Right to left, one digit at a time, with a carry recorded whenever a column
 * overflows *and there is another column to carry into*. The last carry is not
 * a carry at all — it is the leading digit of the answer, and a model that
 * offers a carry box for it is teaching a step that does not exist.
 *
 * `47 × 3` gives: write 1 in the ones, carry 2, write 4 in the tens, write 1
 * in the hundreds.
 */
export function columnSteps(a: number, b: number): ColumnStep[] {
  const digits = String(Math.abs(a)).split("").reverse().map(Number);
  const steps: ColumnStep[] = [];
  let carry = 0;
  let place = 1;
  for (let i = 0; i < digits.length; i += 1) {
    const raw = digits[i] * b + carry;
    steps.push({ kind: "digit", place, value: raw % 10 });
    carry = Math.floor(raw / 10);
    if (carry > 0 && i < digits.length - 1) {
      steps.push({ kind: "carry", place: place * 10, value: carry });
    }
    place *= 10;
  }
  if (carry > 0) steps.push({ kind: "digit", place, value: carry });
  return steps;
}

export function drawColumnProduct(spec: ColumnSpec = {}): Product {
  const digitsA = spec.digitsA ?? 2;
  const digitsB = spec.digitsB ?? 1;
  const mode = spec.carries ?? "any";
  const [aLo, aHi] = rangeForDigits(digitsA);
  const [bLo, bHi] = rangeForDigits(digitsB);

  const ok = (a: number, b: number): boolean => {
    if (digitCount(a) !== digitsA || digitCount(b) !== digitsB) return false;
    if (b < 2 || a < 2) return false;
    if (spec.bNoZeroDigit && !hasNoZeroDigit(b)) return false;
    if (mode === "never") return digitProducts(a, b).every((value) => value <= 9);
    if (mode === "some") return carriesIn(a, b) >= 1;
    return true;
  };

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(aLo, aHi);
    const b = randInt(bLo, bHi);
    if (ok(a, b)) return productOf(a, b);
  }
  for (let a = aLo; a <= aHi; a += 1) {
    for (let b = bLo; b <= bHi; b += 1) {
      if (ok(a, b)) return productOf(a, b);
    }
  }
  throw new Error(`multiplicationNumbers: no column question satisfies ${JSON.stringify(spec)}`);
}

/* -------------------------------------------------------------------------- */
/* Factors, multiples and the properties                                       */
/* -------------------------------------------------------------------------- */

export function factorPairsOf(n: number): [number, number][] {
  if (n < 1) throw new RangeError("multiplicationNumbers: factor pairs need a positive number");
  const pairs: [number, number][] = [];
  for (let i = 1; i * i <= n; i += 1) {
    if (n % i === 0) pairs.push([i, n / i]);
  }
  return pairs;
}

export const isPrime = (n: number): boolean => n > 1 && factorPairsOf(n).length === 1;

export interface FactorSpec {
  range?: [number, number];
  kind?: "prime" | "composite" | "either";
  /** Composite work needs something to find; two pairs is the floor worth asking about. */
  minPairs?: number;
}

export function drawFactorNumber(spec: FactorSpec = {}): number {
  const [lo, hi] = spec.range ?? [12, 100];
  const kind = spec.kind ?? "either";
  const minPairs = spec.minPairs ?? 1;

  const ok = (n: number): boolean => {
    if (n < 2) return false;
    const pairs = factorPairsOf(n).length;
    if (pairs < minPairs) return false;
    if (kind === "prime") return isPrime(n);
    if (kind === "composite") return !isPrime(n);
    return true;
  };

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const candidate = randInt(lo, hi);
    if (ok(candidate)) return candidate;
  }
  for (let n = lo; n <= hi; n += 1) if (ok(n)) return n;
  throw new Error(`multiplicationNumbers: no number satisfies ${JSON.stringify(spec)}`);
}

export interface Triple {
  a: number;
  b: number;
  c: number;
  product: number;
}

export interface TripleSpec {
  range?: [number, number];
  productMax?: number;
}

/** Three factors small enough that either bracketing is worth doing in the head. */
export function drawTriple(spec: TripleSpec = {}): Triple {
  const [lo, hi] = spec.range ?? [2, 6];
  const productMax = spec.productMax ?? 120;
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    const c = randInt(lo, hi);
    if (a * b * c <= productMax) return { a, b, c, product: a * b * c };
  }
  /*
   * Scan, then throw.
   *
   * This used to hand back `lo × lo × lo` when the search ran out, which is a
   * legal triple only by luck: a range starting at six with a ceiling of a
   * hundred and twenty would have returned 216 and called it a question. A
   * constraint is never silently relaxed (§5).
   */
  for (let a = lo; a <= hi; a += 1) {
    for (let b = lo; b <= hi; b += 1) {
      for (let c = lo; c <= hi; c += 1) {
        if (a * b * c <= productMax) return { a, b, c, product: a * b * c };
      }
    }
  }
  throw new Error(`multiplicationNumbers: no triple in ${lo}–${hi} multiplies to ${productMax} or less`);
}

export interface HalveDouble {
  a: number;
  b: number;
  halved: number;
  doubled: number;
  product: number;
}

/**
 * A product that gets easier when one factor is halved and the other doubled.
 *
 * `16 × 5` becomes `8 × 10`. The rewrite has to actually help, so the partner
 * is chosen to land on a ten.
 */
export function drawHalveDouble(spec: ProductSpec = {}): HalveDouble {
  const aRange = spec.aRange ?? [4, 30];
  /* Partners whose double lands on a ten. That is the whole point of the
     rewrite: `16 × 5` is work, `8 × 10` is not. */
  const partners = [5, 15, 25, 50];
  const make = (a: number, b: number): HalveDouble =>
    ({ a, b, halved: a / 2, doubled: b * 2, product: a * b });
  const ok = (a: number, b: number): boolean =>
    a % 2 === 0
    && a >= aRange[0]
    && a <= aRange[1]
    // Not already round. `20 × 50` needs no strategy, and it is the one shape
    // where doubling *either* factor lands on a ten — so the lesson would have
    // two legal rewrites and no reason to prefer one.
    && a % 10 !== 0
    && (b * 2) % 10 === 0
    && (spec.productMax === undefined || a * b <= spec.productMax);

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(aRange[0], aRange[1]);
    const b = pick(partners);
    if (ok(a, b)) return make(a, b);
  }
  // Scan, then throw. The old fallback returned a fixed `16 × 5` whatever the
  // lesson asked for, so a range of 40–60 quietly got a number outside it.
  for (let a = aRange[0]; a <= aRange[1]; a += 1) {
    for (const b of partners) if (ok(a, b)) return make(a, b);
  }
  throw new Error(`multiplicationNumbers: no halve-and-double pair satisfies ${JSON.stringify(spec)}`);
}

/* -------------------------------------------------------------------------- */
/* Scaling by a place                                                          */
/* -------------------------------------------------------------------------- */

export type ScaleKind = "times_ten_hundred" | "multiples_of_ten" | "tens_times_tens";

export interface ScaleSpec {
  /** `times_ten_hundred`: the number being scaled. */
  valueRange?: [number, number];
  /** `multiples_of_ten` and `tens_times_tens`: the single digits behind the tens. */
  digitRange?: [number, number];
  /** `times_ten_hundred`: which scalings the lesson uses. */
  scales?: number[];
}

export interface ScaledProduct {
  a: number;
  b: number;
  product: number;
  /**
   * The product read as a count of a place: `3 × 40` is twelve *tens*.
   *
   * Every one of these three techniques is the same sentence with a different
   * place in it, which is why they share a mode's worth of apparatus — and why
   * `count × place` always reconstructs the product exactly.
   */
  count: number;
  place: number;
  /** How many columns the digits move. Zero where nothing moves. */
  places: number;
  /**
   * The single digits behind the two factors.
   *
   * `30 × 40` is driven by 3 and 4, and its wrong answers are the ones a digit
   * product goes wrong by — so the distractors are built from these rather than
   * from the scaled factors, which would offer misses ten times too far out.
   */
  digitA: number;
  digitB: number;
}

export function drawScaledProduct(kind: ScaleKind, spec: ScaleSpec = {}): ScaledProduct {
  const digits = spec.digitRange ?? [2, 9];

  if (kind === "times_ten_hundred") {
    const [lo, hi] = spec.valueRange ?? [2, 99];
    const scales = spec.scales ?? [10, 100];
    for (let i = 0; i < ATTEMPTS; i += 1) {
      const value = randInt(lo, hi);
      /* A number that already ends in zero hides the lesson: the zero the
         child is meant to watch arrive is sitting there before they start. */
      if (value % 10 === 0) continue;
      const place = pick(scales);
      return { a: value, b: place, product: value * place, count: value, place, places: place === 100 ? 2 : 1, digitA: value, digitB: 1 };
    }
    for (let value = lo; value <= hi; value += 1) {
      if (value % 10 === 0) continue;
      const place = scales[0];
      return { a: value, b: place, product: value * place, count: value, place, places: place === 100 ? 2 : 1, digitA: value, digitB: 1 };
    }
    throw new Error(`multiplicationNumbers: no scalable value in ${lo}–${hi}`);
  }

  const a = randInt(digits[0], digits[1]);
  const b = randInt(digits[0], digits[1]);
  if (kind === "multiples_of_ten") {
    // `n × k0` — n groups of k tens, so the answer is `n × k` tens.
    return { a, b: b * 10, product: a * b * 10, count: a * b, place: 10, places: 1, digitA: a, digitB: b };
  }
  // `a0 × b0` — a tens of b tens. The two zeros come from the two places.
  return { a: a * 10, b: b * 10, product: a * b * 100, count: a * b, place: 100, places: 2, digitA: a, digitB: b };
}

/** Which column a place belongs to, named the way the desk labels it. */
export const PLACE_NAMES: Readonly<Record<number, string>> = Object.freeze({
  1: "ones",
  10: "tens",
  100: "hundreds",
  1000: "thousands",
});

/**
 * The heading over each column.
 *
 * Written out rather than taken from the first letter of the name, which gives
 * thousands and tens the same "T" — on a chart whose entire purpose is telling
 * one column from the next.
 */
export const PLACE_ABBREV: Readonly<Record<number, string>> = Object.freeze({
  1: "O",
  10: "T",
  100: "H",
  1000: "Th",
});

/* -------------------------------------------------------------------------- */
/* Estimation                                                                  */
/* -------------------------------------------------------------------------- */

/** Nearest ten or hundred, halves upward. */
export const roundTo = (n: number, unit: 10 | 100): number => Math.round(n / unit) * unit;

export interface EstimateSpec {
  digitsA?: 2 | 3;
  digitsB?: 1 | 2;
}

/**
 * A product worth estimating.
 *
 * A factor already sitting on its rounding target makes estimating and
 * computing the same act, and a factor exactly halfway rounds differently
 * depending on the convention a child was taught. Both are excluded, so the
 * estimate is always a real approximation of a real product.
 */
export function drawEstimateProduct(spec: EstimateSpec = {}): Product {
  const digitsA = spec.digitsA ?? 2;
  const digitsB = spec.digitsB ?? 1;
  const [aLo, aHi] = rangeForDigits(digitsA);
  const unitA: 10 | 100 = digitsA === 3 ? 100 : 10;

  const worthRounding = (n: number, unit: 10 | 100): boolean =>
    n % unit !== 0 && n % unit !== unit / 2;

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(aLo, aHi);
    const b = digitsB === 1 ? randInt(3, 9) : randInt(11, 99);
    if (!worthRounding(a, unitA)) continue;
    if (digitsB === 2 && !worthRounding(b, 10)) continue;
    return productOf(a, b);
  }
  // Scan, then throw. The old fallback handed back a fixed two-digit `47 × 6`
  // however many digits the lesson asked for (§5).
  for (let a = aLo; a <= aHi; a += 1) {
    if (!worthRounding(a, unitA)) continue;
    for (let b = digitsB === 1 ? 3 : 11; b <= (digitsB === 1 ? 9 : 99); b += 1) {
      if (digitsB === 2 && !worthRounding(b, 10)) continue;
      return productOf(a, b);
    }
  }
  throw new Error(`multiplicationNumbers: no product worth estimating satisfies ${JSON.stringify(spec)}`);
}

/** How far a factor is rounded. `1` means it is small enough to leave alone. */
export type RoundingUnit = 1 | 10 | 100;

export interface EstimatePlan extends Product {
  unitA: RoundingUnit;
  unitB: RoundingUnit;
  roundedA: number;
  roundedB: number;
  /** The product of the rounded pair — what the estimate comes to. */
  estimate: number;
}

/**
 * A product, and what rounding each factor turns it into.
 *
 * A single-digit factor is left alone: rounding six to the nearest ten gives
 * ten, which is a bigger lie than the estimate is worth and teaches a child to
 * round things that did not need it.
 */
export function drawEstimate(spec: EstimateSpec = {}): EstimatePlan {
  const value = drawEstimateProduct(spec);
  const unitA: RoundingUnit = (spec.digitsA ?? 2) === 3 ? 100 : 10;
  const unitB: RoundingUnit = (spec.digitsB ?? 1) === 2 ? 10 : 1;
  const roundedA = roundTo(value.a, unitA);
  const roundedB = unitB === 1 ? value.b : roundTo(value.b, unitB);
  return { ...value, unitA, unitB, roundedA, roundedB, estimate: roundedA * roundedB };
}

export interface ReasonableClaim extends EstimatePlan {
  /** The answer someone is claiming. */
  claim: number;
  reasonable: boolean;
}

/**
 * A claimed answer that is either right or wrong by a whole place.
 *
 * Never wrong by one (§12 trap 13's cousin): a claim of 847 against a true 846
 * cannot be judged by estimating, so it would teach a child to *compute* under
 * the name of estimation. Ten times out is exactly what an estimate catches.
 */
export function drawReasonableClaim(spec: EstimateSpec = {}): ReasonableClaim {
  const plan = drawEstimate(spec);
  const honest = randInt(0, 1) === 0;
  if (honest) return { ...plan, claim: plan.product, reasonable: true };
  const slips = [plan.product * 10, Math.floor(plan.product / 10)].filter((n) => n > 0);
  return { ...plan, claim: pick(slips), reasonable: false };
}

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export type StoryKind =
  | "equal_groups_total"
  | "groups_unknown"
  | "size_unknown"
  | "times_as_many"
  | "rate"
  | "multi_step";

export interface StorySpec {
  groupRange?: [number, number];
  sizeRange?: [number, number];
  smallerRange?: [number, number];
  multiplierRange?: [number, number];
  changeRange?: [number, number];
}

export interface StoryStep {
  operation: "multiply" | "add" | "subtract";
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
  /**
   * The answer a child gives when they read "times as many" as "more than".
   *
   * Supplied rather than left to the engine because a comparison round without
   * this among the choices never tests the confusion it exists to correct.
   */
  additiveAnswer?: number;
}

export function drawMultiplicationStory(kind: StoryKind, spec: StorySpec = {}): StoryNumbers {
  const groups = spec.groupRange ?? [2, 12];
  const size = spec.sizeRange ?? [2, 12];
  const smaller = spec.smallerRange ?? [2, 12];
  const multiplier = spec.multiplierRange ?? [2, 6];
  const change = spec.changeRange ?? [2, 20];

  switch (kind) {
    case "groups_unknown": {
      // Both unknown-factor shapes are generated from the factors, never by
      // dividing a total, so the division always comes out exactly.
      const g = randInt(groups[0], groups[1]);
      const s = randInt(size[0], size[1]);
      return { kind, values: [g * s, s], answer: g };
    }
    case "size_unknown": {
      const g = randInt(groups[0], groups[1]);
      const s = randInt(size[0], size[1]);
      return { kind, values: [g * s, g], answer: s };
    }
    case "times_as_many": {
      /*
       * The trap must not be the answer.
       *
       * "Twice as many as 2" is 4, and so is "two more than 2" - the one pair
       * in range where the multiplicative and additive readings coincide. A
       * round that drew it would mark the misreading this lesson exists to
       * correct as correct, and no test of the arithmetic would notice.
       */
      const distinguishable = (base: number, times: number): boolean =>
        base * times !== base + times;

      for (let i = 0; i < ATTEMPTS; i += 1) {
        const base = randInt(smaller[0], smaller[1]);
        const times = randInt(multiplier[0], multiplier[1]);
        if (distinguishable(base, times)) {
          return { kind, values: [base, times], answer: base * times, additiveAnswer: base + times };
        }
      }
      for (let base = smaller[0]; base <= smaller[1]; base += 1) {
        for (let times = multiplier[0]; times <= multiplier[1]; times += 1) {
          if (distinguishable(base, times)) {
            return { kind, values: [base, times], answer: base * times, additiveAnswer: base + times };
          }
        }
      }
      throw new Error(
        `multiplicationNumbers: every comparison in ${JSON.stringify(spec)} reads the same either way`,
      );
    }
    case "rate": {
      const rate = randInt(size[0], size[1]);
      const count = randInt(groups[0], groups[1]);
      return { kind, values: [rate, count], answer: rate * count };
    }
    case "multi_step": {
      const g = randInt(groups[0], groups[1]);
      const s = randInt(size[0], size[1]);
      const intermediate = g * s;
      /*
       * A subtraction leaves at least one behind.
       *
       * Capped at the intermediate itself, the story could take everything
       * away — "twelve, gives twelve away, how many now?" — and answer zero.
       * True, and a poor question: nothing is left to have been multiplied,
       * and every wrong answer beside it has to be bigger than the right one.
       * Where the first step is too small to take anything from, the story
       * adds instead.
       */
      const mostToTake = Math.min(change[1], intermediate - 1);
      const adds = mostToTake < change[0] || randInt(0, 1) === 0;
      const delta = adds
        ? randInt(change[0], change[1])
        : randInt(change[0], mostToTake);
      const answer = adds ? intermediate + delta : intermediate - delta;
      return {
        kind,
        values: [g, s, delta],
        intermediate,
        answer,
        steps: [
          { operation: "multiply", left: g, right: s, result: intermediate },
          {
            operation: adds ? "add" : "subtract",
            left: intermediate,
            right: delta,
            result: answer,
          },
        ],
      };
    }
    case "equal_groups_total":
    default: {
      const g = randInt(groups[0], groups[1]);
      const s = randInt(size[0], size[1]);
      return { kind: "equal_groups_total", values: [g, s], answer: g * s };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Distractors                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Wrong answers a child actually arrives at.
 *
 * Never the product plus or minus one. A near-square, an added group and a
 * subtracted group all differ from their helper by a whole factor, so a choice
 * list built by nudging the answer by one lets every one of those strategies be
 * solved by looking at the numbers instead of using the strategy — and no test
 * catches it, because the answer is still correct.
 *
 * These come from real routes: adding instead of multiplying, losing or gaining
 * a group, stopping at the helper fact, and slipping a place value.
 */
export function productDistractors(
  value: Product,
  count = 3,
  helperProduct?: number,
): number[] {
  const { a, b, product } = value;
  const candidates = [
    a + b,
    a * (b - 1),
    a * (b + 1),
    (a - 1) * b,
    (a + 1) * b,
    product * 10,
    product % 10 === 0 ? product / 10 : 0,
    helperProduct ?? 0,
    a * (b - 2),
    a * (b + 2),
  ];

  const seen = new Set<number>();
  const usable: number[] = [];
  for (const candidate of candidates) {
    if (!Number.isInteger(candidate) || candidate <= 0) continue;
    if (candidate === product) continue;
    if (Math.abs(candidate - product) === 1) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    usable.push(candidate);
  }

  if (usable.length < count) {
    throw new Error(
      `multiplicationNumbers: only ${usable.length} honest distractors exist for ${a} × ${b}`,
    );
  }
  return shuffle(usable).slice(0, count);
}

/* -------------------------------------------------------------------------- */
/* No repeats inside a round                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Draw something the round has not asked yet.
 *
 * Bounded, not guaranteed: when the legal question space is smaller than the
 * round, a repeat is the correct outcome and a hang is not.
 */
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
