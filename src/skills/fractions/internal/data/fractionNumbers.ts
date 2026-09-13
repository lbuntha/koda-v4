/**
 * Every fraction this skill puts in front of a child.
 *
 * Fifty-seven techniques all need "a fraction, but only one that makes *this*
 * technique the sensible route": comparing by unit size wants the same
 * numerator, simplest form wants a fraction that is not already in it, and an
 * unlike addition wants two denominators that genuinely do not share a size.
 * Written per engine that is twelve slightly different draws and twelve chances
 * to ship a lesson whose fractions quietly do not teach what its title says — a
 * "simplify this" lesson already in simplest form looks completely fine.
 *
 * So it is one module, and the constraints are declared rather than coded.
 *
 * Five rules hold everywhere in here:
 *
 *  1. **A fraction is drawn from a whole, a partition and a count** — never from
 *     a numerator and a denominator. `3/4` is three copies of `1/4` of something
 *     nameable, and the whole travels with it. A child who believes `3/4` is a 3
 *     and a 4 is the child this skill exists for, and a generator that thinks so
 *     too will never contradict them.
 *  2. **The shape constrains the partition, not the reverse.** A bar can show
 *     sevenths; a circle at the size a phone draws it cannot, and a set of twelve
 *     counters can only show the factors of twelve. Drawing `1/7` of a circle
 *     produces visibly unequal parts, which teaches the opposite of the lesson.
 *  3. **Constraints are hard.** `satisfiesFraction` is the single judge, and
 *     every path returns a fraction only after passing it.
 *  4. **Search is bounded.** Random draws get `ATTEMPTS` tries, then a bounded
 *     scan, then a throw. Nothing loops until it gets lucky.
 *  5. **Rare shapes are constructed.** A pair of denominators that share no
 *     factor is not something to wait for when the range is 2 to 12.
 *
 * The primitives are duplicated from division's module rather than imported: a
 * skill may reference another skill's *activity*, never its internals.
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

const ATTEMPTS = 200;
const SCAN_LIMIT = 20_000;

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

export const range = (lo: number, hi: number): number[] =>
  hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);

/* -------------------------------------------------------------------------- */
/* The whole                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What the fraction is *of*.
 *
 * Carried on every fraction and shown on every screen, because "one half" is not
 * an amount until somebody says half of what. Half a pizza and half a stadium
 * are the same fraction and nothing like the same quantity, and a child who has
 * only ever halved one pizza has no reason to know that.
 */
export type WholeKind = "bar" | "circle" | "set" | "length" | "number";

export interface Whole {
  kind: WholeKind;
  /** How it is spoken: "the cake", "the twelve marbles", "the metre". */
  name: string;
  /** How many things are in it, for a set; the unit count for a length. */
  size?: number;
}

/**
 * The partitions a whole can honestly be cut into.
 *
 * This is the rule that keeps the pictures true. A circle drawn in sevenths has
 * parts a child can see are unequal, and a lesson whose picture contradicts its
 * own claim of equal parts teaches the contradiction. A set of twelve counters
 * cannot be cut into fifths at all.
 *
 * Bars are the permissive shape and that is why most lessons use one.
 */
export function partitionsFor(whole: Whole): number[] {
  switch (whole.kind) {
    case "circle":
      // The ones a circle draws with visibly equal parts at the size a phone
      // renders it. Fifths and sevenths are not among them.
      return [2, 3, 4, 6, 8, 12];
    case "set": {
      const size = whole.size ?? 12;
      return range(2, Math.min(12, size)).filter((d) => size % d === 0);
    }
    case "number":
      return range(2, 12);
    case "length":
      return [2, 4, 5, 8, 10];
    default:
      return range(2, 12);
  }
}

export const canPartition = (whole: Whole, parts: number): boolean =>
  partitionsFor(whole).includes(parts);

/** The wholes this skill draws with, and what each is called. */
export const WHOLES: readonly Whole[] = [
  { kind: "bar", name: "the strip" },
  { kind: "bar", name: "the ribbon" },
  { kind: "circle", name: "the cake" },
  { kind: "circle", name: "the pizza" },
  { kind: "set", name: "the 12 marbles", size: 12 },
  { kind: "set", name: "the 8 stickers", size: 8 },
  { kind: "set", name: "the 20 beads", size: 20 },
  { kind: "length", name: "the metre", size: 10 },
  { kind: "number", name: "the number line" },
] as const;

/* -------------------------------------------------------------------------- */
/* Saying it out loud                                                          */
/* -------------------------------------------------------------------------- */

const PART_WORDS: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
  5: ["fifth", "fifths"],
  6: ["sixth", "sixths"],
  7: ["seventh", "sevenths"],
  8: ["eighth", "eighths"],
  9: ["ninth", "ninths"],
  10: ["tenth", "tenths"],
  11: ["eleventh", "elevenths"],
  12: ["twelfth", "twelfths"],
};

/**
 * What one part is called, in English.
 *
 * Because `${parts}th` produces "one 2th" and "12 12ths", and both of those
 * shipped in hints a child was meant to read. A fraction is a word before it is
 * a notation — "three quarters" is what the child says out loud, and a screen
 * that cannot say it back has stopped speaking their language.
 *
 * Past twelve it falls back to the digits, which is honest: nothing in this
 * skill cuts a whole into more than twelve parts, so a "24th" only ever appears
 * after a split, where the numeral is what a child is looking at anyway.
 */
export const partWord = (parts: number, plural = false): string => {
  const pair = PART_WORDS[parts];
  if (!pair) return `${parts}th${plural ? "s" : ""}`;
  return plural ? pair[1] : pair[0];
};

/**
 * "an eighth", "a ninth".
 *
 * Because "a eighth" appeared in a hint, and a child reading the app's own
 * English badly does not trust the app's mathematics either. Only the two
 * vowel-sound names need it, but they need it every time.
 */
export const withArticle = (parts: number): string => {
  const word = partWord(parts);
  return `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
};

/** "three quarters", for a fraction read aloud rather than written. */
export const spokenFraction = (taken: number, parts: number): string =>
  `${taken} ${partWord(parts, taken !== 1)}`;

/* -------------------------------------------------------------------------- */
/* A fraction                                                                  */
/* -------------------------------------------------------------------------- */

export interface Fraction {
  whole: Whole;
  /** The denominator: how many equal parts the whole is cut into. */
  parts: number;
  /** The numerator: how many of those parts are taken. */
  taken: number;
}

export type Frequency = "never" | "always" | "any";

/** How a pair of denominators sit against each other. */
export type Relation = "same" | "nested" | "coprime" | "any";

export interface FractionSpec {
  /** Denominator range. Default 2-12. */
  partsRange?: [number, number];
  /** Numerator range. Default 1..parts-1, resolved per draw. */
  takenRange?: [number, number];
  /** Which wholes may be drawn. Default: all of them. */
  wholeKinds?: WholeKind[];
  /** Whether the fraction is less than one. Default `"always"`. */
  proper?: Frequency;
  /** Whether it is already in simplest form. Default `"any"`. */
  simplified?: Frequency;
  /** Whether it is a unit fraction. Default `"any"`. */
  unit?: Frequency;
  /** Drop `1/1` and `n/n`. Default true. */
  excludeTrivial?: boolean;
}

interface Resolved {
  partsRange: [number, number];
  takenRange?: [number, number];
  wholeKinds: WholeKind[];
  proper: Frequency;
  simplified: Frequency;
  unit: Frequency;
  excludeTrivial: boolean;
}

const resolve = (spec: FractionSpec): Resolved => ({
  partsRange: spec.partsRange ?? [2, 12],
  takenRange: spec.takenRange,
  wholeKinds: spec.wholeKinds ?? ["bar", "circle", "set", "length", "number"],
  proper: spec.proper ?? "always",
  simplified: spec.simplified ?? "any",
  unit: spec.unit ?? "any",
  excludeTrivial: spec.excludeTrivial ?? true,
});

export const isSimplified = (f: Fraction): boolean => gcd(f.taken, f.parts) === 1;
export const isUnit = (f: Fraction): boolean => f.taken === 1;
export const isProper = (f: Fraction): boolean => f.taken < f.parts;
export const valueOf = (f: Fraction): number => f.taken / f.parts;

/** Identity for the repeat guard. The whole is part of it: `1/2` of two different things is two questions. */
export const fractionKey = (f: Fraction): string => `${f.taken}/${f.parts}@${f.whole.name}`;

/**
 * The single judge. Everything returned from this module has passed it.
 *
 * The first check is not a constraint but a truth: the whole must actually be
 * cuttable into this many parts. A fraction that fails it is not a hard
 * question, it is a picture that cannot be drawn honestly.
 */
export function satisfiesFraction(f: Fraction, spec: FractionSpec = {}): boolean {
  const s = resolve(spec);
  if (!Number.isInteger(f.parts) || !Number.isInteger(f.taken)) return false;
  if (f.parts < 2 || f.taken < 1) return false;
  if (!canPartition(f.whole, f.parts)) return false;
  if (!s.wholeKinds.includes(f.whole.kind)) return false;

  if (f.parts < s.partsRange[0] || f.parts > s.partsRange[1]) return false;
  if (s.takenRange && (f.taken < s.takenRange[0] || f.taken > s.takenRange[1])) return false;

  if (s.proper === "always" && !isProper(f)) return false;
  if (s.proper === "never" && isProper(f)) return false;

  if (s.simplified === "always" && !isSimplified(f)) return false;
  if (s.simplified === "never" && isSimplified(f)) return false;

  if (s.unit === "always" && !isUnit(f)) return false;
  if (s.unit === "never" && isUnit(f)) return false;

  if (s.excludeTrivial && f.taken === f.parts) return false;

  return true;
}

/**
 * Draw a fraction that satisfies the spec, or throw saying which spec could not
 * be met.
 *
 * Random first, because it is the only stage that gives variety; a bounded scan
 * second, because a narrow spec — sevenths of a circle, say, which is nothing —
 * has an answer random draws will not find or does not have at all; a throw
 * third, because a spec with no legal fraction is a bug in a lesson and should
 * surface in a test run rather than as a tablet that stops.
 */
export function drawFraction(spec: FractionSpec = {}): Fraction {
  const s = resolve(spec);
  const wholes = WHOLES.filter((w) => s.wholeKinds.includes(w.kind));

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const whole = pick(wholes);
    const options = partitionsFor(whole).filter(
      (d) => d >= s.partsRange[0] && d <= s.partsRange[1],
    );
    if (options.length === 0) continue;
    const parts = pick(options);
    /*
     * The ceiling follows the spec, not the common case.
     *
     * This read `parts - 1` for anything but `proper: "never"`, so a lesson
     * asking for `proper: "any"` never saw an improper fraction and one that
     * turned `excludeTrivial` off could not draw `n/n` at all — the two levels
     * that teach "a fraction can be one whole" would have had nothing to show.
     */
    const hi =
      s.proper === "never" ? parts * 3 : s.proper === "always" ? parts - 1 : parts * 2;
    const lo = s.takenRange?.[0] ?? 1;
    const taken = randInt(lo, Math.max(lo, s.takenRange?.[1] ?? hi));
    const candidate: Fraction = { whole, parts, taken };
    if (satisfiesFraction(candidate, spec)) return candidate;
  }

  let judged = 0;
  for (const whole of shuffle(wholes)) {
    for (const parts of shuffle(partitionsFor(whole))) {
      for (const taken of shuffle(range(1, parts * 3))) {
        if (judged >= SCAN_LIMIT) break;
        judged += 1;
        const candidate: Fraction = { whole, parts, taken };
        if (satisfiesFraction(candidate, spec)) return candidate;
      }
    }
  }

  throw new Error(
    `fractionNumbers: no fraction satisfies ${JSON.stringify(spec)} — check the lesson's constraints`,
  );
}

/* -------------------------------------------------------------------------- */
/* Pairs                                                                       */
/* -------------------------------------------------------------------------- */

export interface FractionPair {
  left: Fraction;
  right: Fraction;
}

export interface PairSpec extends FractionSpec {
  /** How the two denominators relate. Default `"any"`. */
  related?: Relation;
  /** Force the same numerator — the shape level 18 is made of. */
  sameNumerator?: boolean;
  /** Both fractions of the same whole. Default true; level 19 turns it off. */
  sameWhole?: boolean;
  /** The two must not be equal in value. Default true. */
  distinct?: boolean;
}

export const relationOf = (a: number, b: number): Relation => {
  if (a === b) return "same";
  if (a % b === 0 || b % a === 0) return "nested";
  return gcd(a, b) === 1 ? "coprime" : "any";
};

export function satisfiesPair(pair: FractionPair, spec: PairSpec = {}): boolean {
  const { left, right } = pair;
  const wantWhole = spec.sameWhole ?? true;
  if (!satisfiesFraction(left, spec) || !satisfiesFraction(right, spec)) return false;
  if (wantWhole && left.whole.name !== right.whole.name) return false;
  if (!wantWhole && left.whole.name === right.whole.name) return false;
  if (spec.sameNumerator && left.taken !== right.taken) return false;
  if ((spec.distinct ?? true) && valueOf(left) === valueOf(right)) return false;

  const want = spec.related ?? "any";
  if (want !== "any") {
    const actual = relationOf(left.parts, right.parts);
    if (want === "coprime" && actual !== "coprime") return false;
    if (want === "nested" && actual !== "nested") return false;
    if (want === "same" && actual !== "same") return false;
  }
  return true;
}

/**
 * Two fractions that stand in the relationship a lesson asked for.
 *
 * Built by drawing the left and then *choosing* the right, rather than drawing
 * twice and hoping: a coprime pair out of denominators 2 to 12 is about a third
 * of free draws, and "same numerator, different denominator, same whole" is
 * rarer still. Waiting for those is how a round of five takes four seconds.
 */
export function drawPair(spec: PairSpec = {}): FractionPair {
  const wantWhole = spec.sameWhole ?? true;

  for (let i = 0; i < ATTEMPTS; i += 1) {
    const left = drawFraction(spec);
    const partners = partitionsFor(left.whole).filter((d) => {
      const rel = relationOf(left.parts, d);
      const want = spec.related ?? "any";
      if (want === "same") return d === left.parts;
      if (want === "nested") return rel === "nested";
      if (want === "coprime") return rel === "coprime";
      return true;
    });
    for (const parts of shuffle(partners)) {
      const whole = wantWhole
        ? left.whole
        : pick(WHOLES.filter((w) => w.name !== left.whole.name && canPartition(w, parts)));
      if (!whole) continue;
      const taken = spec.sameNumerator
        ? left.taken
        : randInt(1, spec.proper === "never" ? parts * 2 : parts - 1);
      const right: Fraction = { whole, parts, taken };
      const pair = { left, right };
      if (satisfiesPair(pair, spec)) return pair;
    }
  }

  throw new Error(`fractionNumbers: no pair satisfies ${JSON.stringify(spec)}`);
}

/* -------------------------------------------------------------------------- */
/* Mixed numbers                                                               */
/* -------------------------------------------------------------------------- */

export interface MixedNumber {
  whole: Whole;
  /** Whole ones. */
  ones: number;
  /** The fractional part, always proper. */
  parts: number;
  taken: number;
}

/**
 * The same quantity, written the other way.
 *
 * Both directions are here and both are pure, because levels 22 to 24 turn on
 * the two being *the same amount* rather than two notations that happen to be
 * taught together. An engine that converted one way and drew the other from a
 * fresh draw would be showing a child two different quantities and calling them
 * equal.
 */
export const toMixed = (f: Fraction): MixedNumber => ({
  whole: f.whole,
  ones: Math.floor(f.taken / f.parts),
  parts: f.parts,
  taken: f.taken % f.parts,
});

export const toImproper = (m: MixedNumber): Fraction => ({
  whole: m.whole,
  parts: m.parts,
  taken: m.ones * m.parts + m.taken,
});

/* -------------------------------------------------------------------------- */
/* Equivalence and simplest form                                               */
/* -------------------------------------------------------------------------- */

export const scaleBy = (f: Fraction, factor: number): Fraction => ({
  whole: f.whole,
  parts: f.parts * factor,
  taken: f.taken * factor,
});

export const simplify = (f: Fraction): Fraction => {
  const g = gcd(f.taken, f.parts);
  return { whole: f.whole, parts: f.parts / g, taken: f.taken / g };
};

/** Every name for the same amount, up to a denominator of `max`. */
export function equivalentsOf(f: Fraction, max = 24): Fraction[] {
  const base = simplify(f);
  const out: Fraction[] = [];
  for (let k = 1; base.parts * k <= max; k += 1) out.push(scaleBy(base, k));
  return out;
}

/* -------------------------------------------------------------------------- */
/* Wrong answers worth offering                                                */
/* -------------------------------------------------------------------------- */

/**
 * The named ways a child gets a fraction wrong.
 *
 * Typed rather than left as bare fractions because the hints have to say *which*
 * mistake was made — "you added the bottoms too" is a different sentence from
 * "you have the two numbers the other way round" — and a distractor nobody can
 * name is one nobody can explain.
 */
export type FractionFault =
  | "added-denominators"
  | "swapped"
  | "bigger-bottom-is-bigger"
  | "numerator-only"
  | "off-by-one-part";

export interface FractionDistractor {
  value: Fraction;
  fault: FractionFault;
}

/**
 * Wrong fractions that are wrong for a reason.
 *
 * No `taken ± 1` for its own sake — the one neighbour that appears does so under
 * a name, because miscounting the shaded parts by one is a thing that happens.
 * The rest are the misconceptions this whole skill is built to remove.
 */
export function fractionDistractors(f: Fraction, count = 3): FractionDistractor[] {
  const candidates: FractionDistractor[] = [
    { value: { ...f, taken: f.parts, parts: f.taken }, fault: "swapped" },
    { value: { ...f, taken: f.taken + 1 }, fault: "off-by-one-part" },
    { value: { ...f, parts: f.parts + f.taken }, fault: "added-denominators" },
    { value: { ...f, taken: Math.max(1, f.taken - 1) }, fault: "off-by-one-part" },
    { value: { ...f, parts: Math.max(2, f.parts - 1) }, fault: "bigger-bottom-is-bigger" },
    { value: { ...f, parts: f.parts + 1 }, fault: "bigger-bottom-is-bigger" },
  ];

  const seen = new Set<string>([`${f.taken}/${f.parts}`]);
  const usable: FractionDistractor[] = [];
  for (const c of candidates) {
    const key = `${c.value.taken}/${c.value.parts}`;
    /*
     * A distractor is text, not a picture.
     *
     * `parts >= 2` is the rule for a fraction that has to be *drawn* — nothing
     * can be cut into one part. It is the wrong rule here: the swapped form of
     * `1/2` is `2/1`, and that is precisely the belief this skill exists to
     * remove. Rejecting it meant the most important wrong answer disappeared
     * for exactly the fractions where a child is most likely to hold it.
     */
    if (c.value.parts < 1 || c.value.taken < 1) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    usable.push(c);
    if (usable.length === count) break;
  }

  if (usable.length < count) {
    throw new Error(
      `fractionNumbers: only ${usable.length} honest distractors for ${f.taken}/${f.parts}`,
    );
  }
  return shuffle(usable);
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
