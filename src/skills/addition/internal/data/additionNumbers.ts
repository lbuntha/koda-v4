/**
 * Every number this skill asks a child to add.
 *
 * Fifty-two techniques all need "two numbers, but only ones that make *this*
 * technique the sensible route": make-ten wants a pair that crosses ten,
 * compensation wants a second addend ending in 8 or 9, partial sums wants a
 * carry and the place-value chart wants none. Written per engine, that is
 * twelve slightly different `Math.random()` expressions and twelve chances to
 * ship a lesson whose numbers quietly do not teach what its title says — a
 * "regrouping" lesson that never regroups looks completely fine on screen.
 *
 * So it is one module, and the constraints are declared rather than coded:
 * a lesson writes `{ regroup: "never" }` and this decides how to honour it.
 *
 * Three rules hold everywhere in here:
 *
 *  1. **Constraints are hard.** `satisfiesPair` is the single judge, and every
 *     path returns a pair only after passing it. A near-miss is never returned.
 *  2. **Search is bounded.** Random draws get `ATTEMPTS` tries, then a
 *     deterministic scan, then a throw. Nothing loops until it gets lucky —
 *     that is a frozen tablet, and it would happen on the one spec nobody
 *     tried.
 *  3. **Rare shapes are constructed, not waited for.** Two multiples of a
 *     hundred out of a free draw is a 1-in-100 event; asking for it 200 times
 *     still fails 13% of the time. Those shapes are built directly and then
 *     put through the same judge.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/** How many tries any bounded search gets before it stops being random. */
const ATTEMPTS = 200;

/** Inclusive at both ends. The one place randomness enters this skill. */
export const randInt = (lo: number, hi: number): number =>
  hi <= lo ? lo : lo + Math.floor(Math.random() * (hi - lo + 1));

export const pick = <T,>(items: readonly T[]): T => items[randInt(0, items.length - 1)];

/** Fisher–Yates on a copy: a chain's order is part of the question. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const total = (values: readonly number[]): number =>
  values.reduce((acc, n) => acc + n, 0);

/**
 * A number as it is spoken.
 *
 * Words, not digits: the recorded clips are `numbers/seven.wav`, so a screen
 * that said `String(7)` would miss the recording and take the slow path to live
 * TTS on every single tap — the exact cost the recordings exist to remove.
 * Shared because two engines count aloud and a second copy is a second chance
 * to drift from the folder on disk.
 *
 * Past twenty it falls back to the digits, which is honest: nothing above that
 * is recorded, and a lesson that counts that high should say so in `voice.json`.
 */
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty",
];

export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/* -------------------------------------------------------------------------- */
/* Place value — what "regrouping" actually means                              */
/* -------------------------------------------------------------------------- */

export type Place = "ones" | "tens" | "hundreds";

export interface Digits {
  ones: number;
  tens: number;
  hundreds: number;
}

export const digitsOf = (n: number): Digits => ({
  ones: n % 10,
  tens: Math.floor(n / 10) % 10,
  hundreds: Math.floor(n / 100) % 10,
});

/**
 * Which columns carry when these two are added.
 *
 * Walked right to left with the carry fed forward, because that is the only
 * way to get the middle column right: 47 + 36 carries out of the tens as well,
 * and it does so *because* the ones carried first. A check that added the tens
 * digits alone would call this a single-carry problem and quietly file it as a
 * lesson in something it is not.
 */
export function carriesIn(a: number, b: number): Place[] {
  const da = digitsOf(a);
  const db = digitsOf(b);
  const out: Place[] = [];
  let carry = 0;
  for (const place of ["ones", "tens", "hundreds"] as const) {
    const columnSum = da[place] + db[place] + carry;
    carry = columnSum >= 10 ? 1 : 0;
    if (carry === 1) out.push(place);
  }
  return out;
}

export const isRegrouping = (a: number, b: number): boolean => carriesIn(a, b).length > 0;

/** Crosses ten from below: what every make-ten strategy needs and nothing else. */
export const isBridging = (a: number, b: number): boolean =>
  a > 0 && b > 0 && a < 10 && b < 10 && a + b > 10;

/* -------------------------------------------------------------------------- */
/* Pairs                                                                       */
/* -------------------------------------------------------------------------- */

export interface Pair {
  a: number;
  b: number;
  sum: number;
}

const pairOf = (a: number, b: number): Pair => ({ a, b, sum: a + b });

/** Identity of a question, for `withoutRepeat`. Order matters: 3+8 is not 8+3. */
export const pairKey = (p: Pair): string => `${p.a}+${p.b}`;

export interface PairSpec {
  /** Bounds for both addends, unless overridden per side. */
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  sumMin?: number;
  /**
   * Which columns must carry.
   *
   * `"never"` is the one that has to be written deliberately: an omitted
   * `regroup` means "any", so a lesson that needs clean columns and forgets to
   * say so gets carries, and a lesson that needs carries and inherits
   * `"never"` teaches nothing. Both directions have to be stated.
   */
  regroup?: "never" | "ones" | "tens" | "both" | "any";
  /** Both addends are whole multiples of this. */
  multipleOf?: 10 | 100;
  distinct?: boolean;
  /** `|a - b| >= minGap` — what makes switching the addends worth doing. */
  minGap?: number;
  /** `a < 10 < a + b`, both single digits. The make-ten shape. */
  bridging?: boolean;
  /** Last digit of `b` comes from this list — 8 or 9, for compensation. */
  endsIn?: number[];
  /** Values neither addend may take. Where a mode excludes its degenerate case. */
  exclude?: number[];
}

const rangesOf = (spec: PairSpec): { a: [number, number]; b: [number, number] } => ({
  a: spec.aRange ?? spec.addendRange ?? [1, 9],
  b: spec.bRange ?? spec.addendRange ?? [1, 9],
});

/**
 * The single judge. Everything returned from this module passes through here,
 * including the values it constructed itself — a constructor with a bug is
 * exactly as wrong as a bad draw, and this is where both are caught.
 */
export function satisfiesPair(p: Pair, spec: PairSpec): boolean {
  const { a: aR, b: bR } = rangesOf(spec);
  if (p.a < aR[0] || p.a > aR[1]) return false;
  if (p.b < bR[0] || p.b > bR[1]) return false;
  if (spec.sumMax !== undefined && p.sum > spec.sumMax) return false;
  if (spec.sumMin !== undefined && p.sum < spec.sumMin) return false;
  if (spec.distinct && p.a === p.b) return false;
  if (spec.minGap !== undefined && Math.abs(p.a - p.b) < spec.minGap) return false;
  if (spec.multipleOf && (p.a % spec.multipleOf !== 0 || p.b % spec.multipleOf !== 0)) return false;
  if (spec.endsIn && !spec.endsIn.includes(p.b % 10)) return false;
  if (spec.bridging && !isBridging(p.a, p.b)) return false;
  if (spec.exclude && (spec.exclude.includes(p.a) || spec.exclude.includes(p.b))) return false;

  const carries = carriesIn(p.a, p.b);
  switch (spec.regroup) {
    case "never":
      return carries.length === 0;
    case "ones":
      return carries.includes("ones");
    case "tens":
      return carries.includes("tens");
    case "both":
      return carries.includes("ones") && carries.includes("tens");
    default:
      return true;
  }
}

/**
 * One candidate, biased towards the shape the spec asks for.
 *
 * Free draws are fine for anything a third of pairs already satisfy — no
 * regrouping, a minimum gap, a sum ceiling. They are hopeless for the shapes
 * that are rare by construction, so those three are built instead.
 */
function proposePair(spec: PairSpec): Pair {
  const { a: aR, b: bR } = rangesOf(spec);

  if (spec.multipleOf) {
    const m = spec.multipleOf;
    return pairOf(
      m * randInt(Math.ceil(aR[0] / m), Math.floor(aR[1] / m)),
      m * randInt(Math.ceil(bR[0] / m), Math.floor(bR[1] / m)),
    );
  }

  if (spec.bridging) {
    const a = randInt(Math.max(aR[0], 1), Math.min(aR[1], 9));
    const lo = Math.max(bR[0], 11 - a);
    const hi = Math.min(bR[1], 9);
    if (lo <= hi) return pairOf(a, randInt(lo, hi));
  }

  let b = randInt(bR[0], bR[1]);
  if (spec.endsIn && spec.endsIn.length > 0) {
    const wanted = b - (b % 10) + pick(spec.endsIn);
    if (wanted >= bR[0] && wanted <= bR[1]) b = wanted;
  }
  return pairOf(randInt(aR[0], aR[1]), b);
}

/** The last resort: walk the space in order and take the first pair that fits. */
function scanForPair(spec: PairSpec): Pair | undefined {
  const { a: aR, b: bR } = rangesOf(spec);
  let steps = 0;
  for (let a = aR[0]; a <= aR[1]; a += 1) {
    for (let b = bR[0]; b <= bR[1]; b += 1) {
      if ((steps += 1) > 200_000) return undefined;
      const candidate = pairOf(a, b);
      if (satisfiesPair(candidate, spec)) return candidate;
    }
  }
  return undefined;
}

/**
 * A pair matching every constraint.
 *
 * Throws when the spec describes no pair at all. That is an authoring mistake
 * — `{ addendRange: [1, 5], sumMin: 20 }` — and it should stop the round
 * loudly in a test rather than hand a child a question built from a silently
 * relaxed rule.
 */
export function drawPair(spec: PairSpec = {}): Pair {
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const candidate = proposePair(spec);
    if (satisfiesPair(candidate, spec)) return candidate;
  }
  const scanned = scanForPair(spec);
  if (scanned) return scanned;
  throw new Error(`additionNumbers: no pair satisfies ${JSON.stringify(spec)}`);
}

/** `n + n`. The fact, not a pair that happens to be equal. */
export function drawDouble(range: [number, number]): Pair {
  const n = randInt(range[0], range[1]);
  return pairOf(n, n);
}

/**
 * `n + (n ± 1)`, with the double it leans on kept alongside.
 *
 * The double is returned rather than recomputed at the call site because the
 * activity has to *name* it — "you know 6 and 6" — and a screen that derived it
 * differently from the question would be teaching a coincidence.
 */
export function drawNearDouble(
  range: [number, number],
  delta: 1 | -1,
): Pair & { double: number } {
  const n = randInt(range[0], range[1]);
  return { ...pairOf(n, n + delta), double: n + n };
}

/* -------------------------------------------------------------------------- */
/* Chains — three or more addends                                              */
/* -------------------------------------------------------------------------- */

export interface ChainSpec {
  addendRange?: [number, number];
  totalMax?: number;
  totalMin?: number;
  distinct?: boolean;
}

export function drawChain(count: number, spec: ChainSpec = {}): number[] {
  const [lo, hi] = spec.addendRange ?? [2, 9];
  for (let i = 0; i < ATTEMPTS; i += 1) {
    const parts = Array.from({ length: count }, () => randInt(lo, hi));
    const sum = total(parts);
    if (spec.totalMax !== undefined && sum > spec.totalMax) continue;
    if (spec.totalMin !== undefined && sum < spec.totalMin) continue;
    if (spec.distinct && new Set(parts).size !== parts.length) continue;
    return parts;
  }
  // The smallest legal chain. It cannot break a ceiling, and a chain of the
  // lowest addend is a dull question rather than a wrong one.
  return Array.from({ length: count }, (_, i) => Math.min(hi, lo + (spec.distinct ? i : 0)));
}

/** Unordered index pairs whose values add to `target`. The property `pairs` mode rests on. */
export function friendlyPairCount(values: readonly number[], target: number): number {
  let found = 0;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i] + values[j] === target) found += 1;
    }
  }
  return found;
}

/**
 * A chain holding exactly `pairsWanted` pairs that make `target`.
 *
 * Built rather than sampled, and each value is checked against the ones already
 * chosen before it joins them. Sampling would need a retry loop whose exit
 * condition is a coincidence, and *exactly one* pair is the whole question —
 * a chain with a second hidden ten makes the child's correct answer look wrong.
 */
export function drawFriendlyChain(count: number, target: 10 | 100, pairsWanted = 1): number[] {
  const step = target === 10 ? 1 : 10;
  const candidates = Array.from({ length: target / step - 1 }, (_, i) => (i + 1) * step);
  const values: number[] = [];

  const wouldStayClean = (v: number, allowed: number) =>
    friendlyPairCount([...values, v], target) <= allowed;

  for (let p = 0; p < pairsWanted; p += 1) {
    // Bases below half, so (a, target - a) is named once and two pairs can
    // never share a partner — which is what would create a third, unwanted pair.
    const bases = shuffle(candidates.filter((v) => v * 2 < target));
    const base = bases.find(
      (v) => !values.includes(v) && !values.includes(target - v),
    );
    if (base === undefined) break;
    values.push(base, target - base);
  }

  while (values.length < count) {
    const filler = shuffle(candidates).find(
      (v) => v * 2 !== target && wouldStayClean(v, friendlyPairCount(values, target)),
    );
    if (filler === undefined) break;
    values.push(filler);
  }

  return shuffle(values);
}

/* -------------------------------------------------------------------------- */
/* Estimation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Two numbers worth rounding.
 *
 * Neither may already end in zero — rounding a number that is already round
 * teaches nothing — and neither sits exactly halfway, because "round half up"
 * is a separate rule and a child meeting it inside an estimation lesson learns
 * that estimation is arbitrary.
 */
export function drawRoundingPair(digits: 2 | 3): Pair {
  const [lo, hi] = digits === 2 ? [11, 99] : [101, 999];
  const roundable = (n: number) =>
    digits === 2 ? n % 10 !== 0 && n % 10 !== 5 : n % 100 !== 0 && n % 100 !== 50 && n % 10 !== 0;

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    if (roundable(a) && roundable(b)) return pairOf(a, b);
  }
  return digits === 2 ? pairOf(23, 48) : pairOf(347, 286);
}

/** Nearest ten or hundred, halves upward. What the estimate is judged against. */
export const roundTo = (n: number, unit: 10 | 100): number => Math.round(n / unit) * unit;

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

export type StoryKind =
  | "join"
  | "ppw"
  | "change_unknown"
  | "start_unknown"
  | "compare"
  | "multi_step";

export interface StorySpec {
  startRange?: [number, number];
  changeRange?: [number, number];
  partRange?: [number, number];
  differenceRange?: [number, number];
}

export interface StoryNumbers {
  kind: StoryKind;
  /** The quantities the sentence names, in the order it names them. */
  values: number[];
  /** What the child must produce. */
  answer: number;
  /** `multi_step` only: the answer to step one, which is its own question. */
  intermediate?: number;
}

/**
 * The numbers behind one word problem.
 *
 * Which quantities the story *states* and which one it withholds is the entire
 * difference between the six types — a join problem and a start-unknown problem
 * are the same arithmetic and a completely different task. So the unknown is
 * chosen here, with the numbers, rather than by an activity deciding later
 * which value to blank out.
 */
export function drawStory(kind: StoryKind, spec: StorySpec = {}): StoryNumbers {
  const start = spec.startRange ?? [3, 20];
  const change = spec.changeRange ?? [2, 15];
  const part = spec.partRange ?? [3, 20];
  const difference = spec.differenceRange ?? [2, 15];

  switch (kind) {
    case "ppw": {
      const a = randInt(part[0], part[1]);
      const b = randInt(part[0], part[1]);
      return { kind, values: [a, b], answer: a + b };
    }
    case "change_unknown": {
      const from = randInt(start[0], start[1]);
      const by = randInt(change[0], change[1]);
      return { kind, values: [from, from + by], answer: by };
    }
    case "start_unknown": {
      const by = randInt(change[0], change[1]);
      const from = randInt(start[0], start[1]);
      return { kind, values: [by, from + by], answer: from };
    }
    case "compare": {
      const smaller = randInt(part[0], part[1]);
      const by = randInt(difference[0], difference[1]);
      return { kind, values: [smaller, by], answer: smaller + by };
    }
    case "multi_step": {
      const one = randInt(part[0], part[1]);
      const two = randInt(part[0], part[1]);
      const three = randInt(change[0], change[1]);
      return { kind, values: [one, two, three], answer: one + two + three, intermediate: one + two };
    }
    case "join":
    default: {
      const from = randInt(start[0], start[1]);
      const by = randInt(change[0], change[1]);
      return { kind: "join", values: [from, by], answer: from + by };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* No repeats inside a round                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Draw something this round has not already asked.
 *
 * Five questions that are all `3 + 4` is a broken round, and with the small
 * ranges the early lessons use it is not unlikely — nine possible pairs and
 * five questions collide about nine times in ten. Bounded, and it gives up
 * rather than blocking: a repeat is a dull question, a hang is a dead app.
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
