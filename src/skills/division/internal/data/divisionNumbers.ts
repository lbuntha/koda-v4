/**
 * Every number this skill asks a child to divide.
 *
 * Fifty-six techniques all need "a dividend and a divisor, but only ones that
 * make *this* technique the sensible route": short division wants a carry into
 * the next place, `split-by-place` wants no carry at all, `write-the-remainder`
 * wants a remainder every single time, and `zero-in-the-quotient` wants a zero
 * sitting inside the answer. Written per engine, that is twelve slightly
 * different `Math.random()` expressions and twelve chances to ship a lesson
 * whose numbers quietly do not teach what its title says — a "leftovers" lesson
 * that comes out even looks completely fine on screen.
 *
 * So it is one module, and the constraints are declared rather than coded:
 * a lesson writes `{ remainder: "always", exchange: "never" }` and this decides
 * how to honour it.
 *
 * Four rules hold everywhere in here:
 *
 *  1. **Questions are built from the answer outwards.** Nothing draws a
 *     dividend and divides it. It draws a quotient, a divisor and a remainder
 *     inside `[0, divisor)`, then multiplies back. Drawing a dividend first
 *     gives a lesson whatever remainders chance supplies, which is exactly how
 *     `remainder: "never"` ships with remainders in it.
 *  2. **Constraints are hard.** `satisfiesQuotient` is the single judge, and
 *     every path returns a question only after passing it. A near-miss is never
 *     returned.
 *  3. **Search is bounded.** Random draws get `ATTEMPTS` tries, then a bounded
 *     deterministic scan, then a throw. Nothing loops until it gets lucky —
 *     that is a frozen tablet, and it would happen on the one spec nobody tried.
 *  4. **Rare shapes are constructed, not waited for.** A quotient with a zero
 *     inside it is a few percent of a free draw; asking 200 times still fails
 *     often enough to matter. Those are built directly and then put through the
 *     same judge.
 *
 * The primitives at the top are duplicated from multiplication's module rather
 * than imported: a skill may reference another skill's *activity*, never its
 * internals. Twenty lines of `randInt` and `shuffle` is the price of that rule,
 * and it is the right price.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** How many tries any bounded search gets before it stops being random. */
const ATTEMPTS = 200;

/**
 * How many candidate questions the deterministic fallback will judge before it
 * gives up and throws.
 *
 * A cap rather than a full enumeration because the legal space for a long
 * division spec is millions of combinations, and a tablet that takes four
 * seconds to produce a question has failed whether or not it eventually
 * succeeds. Reached only after `ATTEMPTS` random misses, which for every spec
 * in the plan means never.
 */
const SCAN_LIMIT = 50_000;

/** Inclusive at both ends. The one place randomness enters this skill. */
export const randInt = (lo: number, hi: number): number =>
  hi <= lo ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));

export const pick = <T,>(items: readonly T[]): T => items[randInt(0, items.length - 1)];

/** Fisher–Yates on a copy: the order a scan walks in is part of the variety. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Inclusive integer range as an array. */
export const range = (lo: number, hi: number): number[] =>
  hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/* -------------------------------------------------------------------------- */
/* The two meanings of one symbol                                              */
/* -------------------------------------------------------------------------- */

/**
 * Which question `a ÷ b` is being asked.
 *
 * `"share"` — a is dealt out between b groups; the answer is **how many each**.
 * `"group"` — a is measured into groups of b; the answer is **how many groups**.
 *
 * Carried on every question rather than left to the lesson copy, because the
 * models disagree about it: hopping back along a number line shows grouping and
 * cannot honestly show sharing, and a remainder is "what could not be dealt"
 * in one and "what is left of a short final lot" in the other. A generator that
 * did not know which it was producing would let a sharing lesson fill up with
 * grouping questions, and nothing on screen would look wrong.
 */
export type Meaning = "share" | "group";

/* -------------------------------------------------------------------------- */
/* Place value                                                                 */
/* -------------------------------------------------------------------------- */

/** Digits left to right, as the written method walks them. */
export const digitsOf = (n: number): number[] =>
  String(Math.abs(n)).split("").map(Number);

export const digitCount = (n: number): number => String(Math.abs(n)).length;

/**
 * A zero with a digit on both sides of it — 103, 4052.
 *
 * Not a leading zero (numbers do not have those) and not a trailing one: 120 ÷ 4
 * is an ordinary question, while 618 ÷ 6 = 103 is the one where a child writes
 * 13 and the working still looks tidy. Level 36 exists for that zero alone, so
 * the generator has to be able to name it.
 */
export const hasInteriorZero = (n: number): boolean => {
  const digits = digitsOf(n);
  return digits.slice(1, -1).includes(0);
};

/**
 * The number split into the values of its digits: 420 becomes 400 and 20.
 *
 * Zeros drop out, because a place holding nothing is not a part to divide.
 */
export const placeSplit = (n: number): number[] =>
  String(Math.abs(n))
    .split("")
    .map((digit, i, all) => Number(digit) * 10 ** (all.length - 1 - i))
    .filter((part) => part > 0);

/**
 * Whether every *place value* of the dividend divides the divisor on its own.
 *
 * Not the same question as `exchangesIn`, and the difference is the reason this
 * exists. Short division walks *digits*: 420 ÷ 4 hits "2 tens ÷ 4", which does
 * not go, and carries. Splitting by place value asks about 400 and 20, and both
 * of those divide by 4 perfectly well. So 420 ÷ 4 exchanges *and* splits
 * cleanly, and a lesson about splitting that had been told to use the
 * exchange constraint would have rejected it — or worse, accepted it while
 * claiming the opposite.
 *
 * `exchange` belongs to the written-method engine. This belongs to the
 * place-value one.
 */
export const placeSplitWorks = (dividend: number, divisor: number): boolean =>
  placeSplit(dividend).every((part) => part % divisor === 0);

/* -------------------------------------------------------------------------- */
/* The written method, walked                                                  */
/* -------------------------------------------------------------------------- */

/** One place of short division, in the order a child works them. */
export interface DivisionStep {
  /** The digit of the dividend being brought down, left to right. */
  digit: number;
  /** What is actually divided here: the carry from the last place, then this digit. */
  working: number;
  /** The digit written above the line. */
  quotientDigit: number;
  /** What is carried into the next place. The last one is the remainder. */
  carry: number;
}

/**
 * Short division, place by place, left to right.
 *
 * The engine for levels 33–38 will draw exactly this, and until then it is how
 * `exchange` is decided: an exchange is a carry out of any place but the last.
 * Written here rather than in the engine so that the constraint a lesson
 * declares and the working a child sees can never describe different sums.
 */
export function shortDivisionSteps(dividend: number, divisor: number): DivisionStep[] {
  if (divisor <= 0) throw new Error("divisionNumbers: divisor must be positive");
  let carry = 0;
  return digitsOf(dividend).map((digit) => {
    const working = carry * 10 + digit;
    const quotientDigit = Math.floor(working / divisor);
    carry = working % divisor;
    return { digit, working, quotientDigit, carry };
  });
}

/**
 * How many places hand something on to the next one.
 *
 * Zero means every digit of the dividend divides the divisor on its own — the
 * `split-by-place` shape at level 29, where 96 ÷ 3 is honestly (90 ÷ 3) + (6 ÷ 3).
 * One or more is level 30 and everything after it. The final carry is the
 * remainder and is not an exchange, which is why the last step is dropped.
 */
export const exchangesIn = (dividend: number, divisor: number): number =>
  shortDivisionSteps(dividend, divisor)
    .slice(0, -1)
    .filter((step) => step.carry > 0).length;

/* -------------------------------------------------------------------------- */
/* A question                                                                  */
/* -------------------------------------------------------------------------- */

export interface Quotient {
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  meaning: Meaning;
}

/** How often a shape must appear. `"any"` declares nothing and constrains nothing. */
export type Frequency = "never" | "always" | "any";

export interface QuotientSpec {
  /** What is divided by. Default 2–9. */
  divisorRange?: [number, number];
  /** The answer. Default 2–12. */
  quotientRange?: [number, number];
  /** An extra bound on the total, applied after it is built. */
  dividendRange?: [number, number];
  /** Default `"never"` — most lessons before level 22 must come out even. */
  remainder?: Frequency;
  /** Whether a place hands something to the next. Default `"any"`. */
  exchange?: Frequency;
  /** Whether the answer has a zero inside it. Default `"any"`. */
  zeroInQuotient?: Frequency;
  /**
   * Whether splitting the dividend by place value gives parts that all divide.
   *
   * The place-value engine's constraint, and deliberately not `exchange` — see
   * `placeSplitWorks` for why those are different questions.
   */
  placeSplit?: Frequency;
  /** Fixed for lessons that teach one meaning; drawn for lessons that mix them. */
  meaning?: Meaning;
  /** Drop `÷ 1` and `n ÷ n`. Default true; levels 6 and 7 turn it off. */
  excludeTrivial?: boolean;
  /**
   * Refuse a square: `quotient === divisor`.
   *
   * A 4x4 array gives the same division read both ways, so level 10 — "two
   * divisions from one array" — would be asking for the same sentence twice
   * and scoring it as two. Nothing else in the skill minds a square.
   */
  distinctSides?: boolean;
}

interface ResolvedSpec {
  divisorRange: [number, number];
  quotientRange: [number, number];
  dividendRange?: [number, number];
  remainder: Frequency;
  exchange: Frequency;
  zeroInQuotient: Frequency;
  placeSplit: Frequency;
  meaning?: Meaning;
  excludeTrivial: boolean;
  distinctSides: boolean;
}

const resolve = (spec: QuotientSpec): ResolvedSpec => ({
  divisorRange: spec.divisorRange ?? [2, 9],
  quotientRange: spec.quotientRange ?? [2, 12],
  dividendRange: spec.dividendRange,
  remainder: spec.remainder ?? "never",
  exchange: spec.exchange ?? "any",
  zeroInQuotient: spec.zeroInQuotient ?? "any",
  placeSplit: spec.placeSplit ?? "any",
  meaning: spec.meaning,
  excludeTrivial: spec.excludeTrivial ?? true,
  distinctSides: spec.distinctSides ?? false,
});

/** Identity for the repeat guard. Meaning is part of it: the same numbers asked both ways are two questions. */
export const quotientKey = (value: Quotient): string =>
  `${value.dividend}/${value.divisor}:${value.meaning}`;

const within = (n: number, [lo, hi]: [number, number]): boolean => n >= lo && n <= hi;

/**
 * The single judge. Everything returned from this module has passed it.
 *
 * The first check is arithmetic rather than a constraint, and it is the one that
 * matters most: `q · d + r = dividend` with `0 ≤ r < d`. A question that fails it
 * is not a hard question, it is a wrong one.
 */
export function satisfiesQuotient(value: Quotient, spec: QuotientSpec = {}): boolean {
  const s = resolve(spec);
  const { dividend, divisor, quotient, remainder } = value;

  if (!Number.isInteger(dividend) || !Number.isInteger(divisor)) return false;
  if (!Number.isInteger(quotient) || !Number.isInteger(remainder)) return false;
  if (divisor < 1) return false;
  if (remainder < 0 || remainder >= divisor) return false;
  if (quotient * divisor + remainder !== dividend) return false;

  if (!within(divisor, s.divisorRange)) return false;
  if (!within(quotient, s.quotientRange)) return false;
  if (s.dividendRange && !within(dividend, s.dividendRange)) return false;

  if (s.remainder === "never" && remainder !== 0) return false;
  if (s.remainder === "always" && remainder === 0) return false;

  if (s.exchange !== "any") {
    const exchanges = exchangesIn(dividend, divisor);
    if (s.exchange === "never" && exchanges !== 0) return false;
    if (s.exchange === "always" && exchanges === 0) return false;
  }

  if (s.zeroInQuotient !== "any") {
    const inside = hasInteriorZero(quotient);
    if (s.zeroInQuotient === "never" && inside) return false;
    if (s.zeroInQuotient === "always" && !inside) return false;
  }

  if (s.placeSplit !== "any") {
    const splits = placeSplitWorks(dividend, divisor);
    if (s.placeSplit === "never" && splits) return false;
    if (s.placeSplit === "always" && !splits) return false;
  }

  if (s.meaning && value.meaning !== s.meaning) return false;
  if (s.excludeTrivial && (divisor === 1 || quotient === 1)) return false;
  if (s.distinctSides && quotient === divisor) return false;

  return true;
}

const meaningFor = (s: ResolvedSpec): Meaning =>
  s.meaning ?? (Math.random() < 0.5 ? "share" : "group");

/** Which remainders this spec allows for a given divisor. */
const remaindersFor = (s: ResolvedSpec, divisor: number): number[] => {
  if (s.remainder === "never") return [0];
  const nonZero = range(1, divisor - 1);
  return s.remainder === "always" ? nonZero : [0, ...nonZero];
};

const build = (divisor: number, quotient: number, remainder: number, meaning: Meaning): Quotient => ({
  dividend: quotient * divisor + remainder,
  divisor,
  quotient,
  remainder,
  meaning,
});

/**
 * Draw a question that satisfies the spec, or throw saying which spec could not
 * be met.
 *
 * Three stages, in this order and for this reason: random first because it is
 * the only one that gives variety; a shuffled scan second because a narrow spec
 * (`zeroInQuotient: "always"` with a small quotient range) has a legal answer
 * that random draws will not find; a throw third because a spec with no legal
 * answer at all is a bug in a lesson, and it should surface in a test run rather
 * than as a tablet that stops.
 */
export function drawQuotient(spec: QuotientSpec = {}): Quotient {
  const s = resolve(spec);

  // Rare shapes are constructed rather than waited for.
  if (s.zeroInQuotient === "always") return drawInteriorZero(s, spec);

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const divisor = randInt(s.divisorRange[0], s.divisorRange[1]);
    const quotient = randInt(s.quotientRange[0], s.quotientRange[1]);
    const allowed = remaindersFor(s, divisor);
    if (allowed.length === 0) continue;
    const candidate = build(divisor, quotient, pick(allowed), meaningFor(s));
    if (satisfiesQuotient(candidate, spec)) return candidate;
  }

  const found = scan(s, spec);
  if (found) return found;

  throw new Error(
    `divisionNumbers: no question satisfies ${JSON.stringify(spec)} — check the lesson's constraints`,
  );
}

/**
 * Every legal combination, walked in a shuffled order, up to the cap.
 *
 * Shuffled so that the emergency path does not always hand back the same
 * question: a spec narrow enough to need the scan is usually one a whole round
 * will be drawn from, and ten identical questions is a worse failure than a
 * slow one.
 */
function scan(s: ResolvedSpec, spec: QuotientSpec): Quotient | undefined {
  let judged = 0;
  for (const divisor of shuffle(range(s.divisorRange[0], s.divisorRange[1]))) {
    for (const quotient of shuffle(range(s.quotientRange[0], s.quotientRange[1]))) {
      for (const remainder of shuffle(remaindersFor(s, divisor))) {
        if (judged >= SCAN_LIMIT) return undefined;
        judged += 1;
        const candidate = build(divisor, quotient, remainder, meaningFor(s));
        if (satisfiesQuotient(candidate, spec)) return candidate;
      }
    }
  }
  return undefined;
}

/**
 * The `zero-in-the-quotient` shape, built from the quotient inwards.
 *
 * 618 ÷ 6 = 103 is the question level 36 is made of, and a free draw over a
 * three-digit quotient range produces one about one time in ten. Starting from
 * the answers that have the zero, rather than hoping for them, is the difference
 * between a lesson that teaches the error and a lesson that mentions it.
 */
function drawInteriorZero(s: ResolvedSpec, spec: QuotientSpec): Quotient {
  const quotients = shuffle(
    range(s.quotientRange[0], s.quotientRange[1]).filter(hasInteriorZero),
  );

  for (const quotient of quotients) {
    for (const divisor of shuffle(range(s.divisorRange[0], s.divisorRange[1]))) {
      for (const remainder of shuffle(remaindersFor(s, divisor))) {
        const candidate = build(divisor, quotient, remainder, meaningFor(s));
        if (satisfiesQuotient(candidate, spec)) return candidate;
      }
    }
  }

  throw new Error(
    `divisionNumbers: no quotient in [${s.quotientRange}] has a zero inside it that also satisfies ${JSON.stringify(spec)}`,
  );
}

/* -------------------------------------------------------------------------- */
/* Grouping-only questions                                                     */
/* -------------------------------------------------------------------------- */

/** A question whose model can honestly be drawn as hops along a line. */
export type GroupQuotient = Quotient & { meaning: "group" };

/**
 * The number-line engines' only entry point.
 *
 * Hopping back from the total in steps of the divisor shows *how many lots of
 * this size fit* — grouping. There is no honest number-line picture of dealing
 * a total out between a number of people, and drawing one anyway is how a child
 * comes to believe the divisor is always the step size. The type, not a comment,
 * is what stops levels 12–14 asking for a sharing question: `meaning` cannot be
 * passed in, and what comes back is narrowed to `"group"`.
 */
export function drawGroupQuotient(spec: Omit<QuotientSpec, "meaning"> = {}): GroupQuotient {
  return drawQuotient({ ...spec, meaning: "group" }) as GroupQuotient;
}

/* -------------------------------------------------------------------------- */
/* Wrong answers worth offering                                                */
/* -------------------------------------------------------------------------- */

/**
 * The named ways a child gets a division wrong.
 *
 * Typed rather than left as bare numbers because division's hints need to say
 * *which* mistake was made — "that is the number of groups, not how many are in
 * each" is a different sentence from "you have lost a place" — and a distractor
 * that cannot be named is one nobody can explain.
 */
export type DistractorKind =
  | "swapped-roles"
  | "dropped-quotient-zero"
  | "place-value-slip"
  | "rounded-the-remainder"
  | "off-by-one-group"
  | "remainder-as-answer"
  | "subtracted-instead";

export interface Distractor {
  value: number;
  kind: DistractorKind;
}

/**
 * Three wrong answers, each one an error a child actually makes.
 *
 * No `answer ± 1` for its own sake. The two neighbours that do appear are there
 * under a name: `rounded-the-remainder` is offered only when there *is* a
 * remainder to round, and `off-by-one-group` is the miscount that comes from
 * dealing. A near-miss with no story behind it teaches a child to look at the
 * options instead of at the question.
 */
export function quotientDistractors(value: Quotient, count = 3): Distractor[] {
  const { dividend, divisor, quotient, remainder } = value;

  const candidates: Distractor[] = [
    { value: divisor, kind: "swapped-roles" },
    { value: Number(String(quotient).replace("0", "")), kind: "dropped-quotient-zero" },
    { value: quotient * 10, kind: "place-value-slip" },
    { value: Math.floor(quotient / 10), kind: "place-value-slip" },
    { value: remainder, kind: "remainder-as-answer" },
    { value: quotient + 1, kind: "rounded-the-remainder" },
    { value: quotient - 1, kind: "off-by-one-group" },
    { value: dividend - divisor, kind: "subtracted-instead" },
    { value: quotient * 100, kind: "place-value-slip" },
  ];

  const seen = new Set<number>();
  const usable: Distractor[] = [];
  for (const candidate of candidates) {
    const { value: n, kind } = candidate;
    if (!Number.isInteger(n) || n <= 0) continue;
    if (n === quotient) continue;
    if (seen.has(n)) continue;
    // Only offered when the mistake is available to make.
    if (kind === "rounded-the-remainder" && remainder === 0) continue;
    if (kind === "dropped-quotient-zero" && !hasInteriorZero(quotient)) continue;
    seen.add(n);
    usable.push(candidate);
  }

  if (usable.length < count) {
    throw new Error(
      `divisionNumbers: only ${usable.length} honest distractors exist for ${dividend} ÷ ${divisor}`,
    );
  }

  /*
   * Chosen in order, shuffled only for where they sit on screen.
   *
   * The candidate list above is written most-plausible first, and a uniform
   * shuffle threw that away: `20 / 4 = 500` was being offered beside `= 5`,
   * where a child rules it out by size without dividing anything. Taking the
   * first `count` keeps the near misconceptions — the roles swapped, one place
   * lost, a group miscounted — and leaves the far ones as filler for questions
   * where the near ones collide.
   */
  return shuffle(usable.slice(0, count));
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
