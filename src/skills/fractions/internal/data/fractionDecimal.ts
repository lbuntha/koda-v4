/**
 * The same number, wearing three different clothes.
 *
 * A child who can say `3/4` and `0.75` and `75%` without knowing they are one
 * number has learned three subjects. They are one subject, and the thing that
 * joins them is the denominator nobody writes down: tenths, then hundredths,
 * and percent is just hundredths with a different sign after it.
 *
 * So the order here is the place-value order, not the textbook order. Tenths
 * first, because a decimal point is a fraction whose bottom number is written
 * as a position. Hundredths second. Dividing to get a decimal third, once the
 * child knows what the answer is supposed to look like. Percent last but one,
 * as hundredths renamed — never as a separate arithmetic.
 *
 * Everything here terminates. `1/3 = 0.333…` is true, interesting and a
 * different lesson; a level that drew it would be asking a child to round
 * without having taught rounding, and the answer key would be a lie either way.
 */

import {
  gcd,
  partWord,
  pick,
  randInt,
  shuffle,
  simplify,
  valueOf,
  withoutRepeat,
  type Fraction,
  type Whole,
} from "./fractionNumbers";

export type DecimalMode =
  /** `n/10` and `0.n` are the same number. */
  | "tenths"
  /** `n/100` and `0.nn`. */
  | "hundredths"
  /** Divide the top by the bottom to get the decimal. */
  | "by_dividing"
  /** A decimal written back as a fraction, in simplest form. */
  | "from_decimal"
  /** Percent, which is hundredths with a different sign. */
  | "percent"
  /** Match a fraction, a decimal and a percent. */
  | "three_names";

export interface DecimalSetup {
  mode?: DecimalMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  /** Which denominators `by_dividing` may draw. All of them terminate. */
  denominators?: number[];
}

const BAR: Whole = { kind: "bar", name: "the strip" };

/**
 * Denominators whose decimals stop.
 *
 * A fraction terminates exactly when its simplified denominator has no prime
 * factor but two and five. These are the ones under fifty that a child meets,
 * and sixteenths are left out because `0.0625` is four places for no gain.
 */
export const TERMINATING = [2, 4, 5, 8, 10, 20, 25, 50];

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

/**
 * The exact decimal for a fraction that terminates.
 *
 * Built from integers and then punctuated, rather than divided and rounded:
 * `0.1 + 0.2` is not `0.3` in this language, and an answer key produced by
 * floating-point division is wrong often enough to matter.
 */
export function decimalText(taken: number, parts: number): string {
  const places = placesFor(parts);
  const scaled = Math.round((taken * 10 ** places) / parts);
  if ((scaled * parts) / 10 ** places !== taken) {
    throw new Error(`fractions/decimal: ${taken}/${parts} does not terminate in ${places} places`);
  }
  if (places === 0) return String(scaled);
  const digits = String(scaled).padStart(places + 1, "0");
  const whole = digits.slice(0, digits.length - places);
  const rest = digits.slice(digits.length - places).replace(/0+$/, "");
  return rest.length === 0 ? whole : `${whole}.${rest}`;
}

/** How many decimal places this denominator needs. */
export function placesFor(parts: number): number {
  let n = parts;
  let twos = 0;
  let fives = 0;
  while (n % 2 === 0) {
    n /= 2;
    twos += 1;
  }
  while (n % 5 === 0) {
    n /= 5;
    fives += 1;
  }
  if (n !== 1) throw new Error(`fractions/decimal: ${parts} does not terminate`);
  return Math.max(twos, fives);
}

/** A decimal string back to a fraction in simplest form. */
export function fractionFromDecimal(text: string): Fraction {
  const [whole, rest = ""] = text.split(".");
  const places = rest.length;
  const top = Number(whole) * 10 ** places + Number(rest || "0");
  return simplify({ whole: BAR, parts: 10 ** places, taken: top });
}

/** The percent for a fraction, as a whole number of percent. */
export function percentOf(taken: number, parts: number): number {
  const value = (taken * 100) / parts;
  if (!Number.isInteger(value)) throw new Error(`fractions/decimal: ${taken}/${parts} is not a whole percent`);
  return value;
}

export interface DecimalQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: DecimalMode;
  /** The quantity, however it is being asked about. */
  fraction: Fraction;
  /** What the child is being asked to produce. */
  wants: "decimal" | "fraction" | "percent" | "row";
  /**
   * What the picture draws: ten squares, a hundred, or the fraction's own bar.
   *
   * A hundred-square cannot show sevenths or eighths — `7/8` rounds to 88 of
   * the hundred and the picture then disagrees with the answer by half a
   * square. The dividing level draws its own denominator instead, which is the
   * honest picture and also the one the question is about.
   */
  grid: 10 | 100 | "fraction";
  options: string[];
}

const PROMPTS: Record<DecimalMode, (q: Omit<DecimalQuestion, "prompt">) => string> = {
  tenths: (q) => `${nameOf(q.fraction)} — write it as a decimal`,
  hundredths: (q) => `${nameOf(q.fraction)} — write it as a decimal`,
  by_dividing: (q) => `${nameOf(q.fraction)} as a decimal`,
  from_decimal: (q) => `${decimalText(q.fraction.taken, q.fraction.parts)} as a fraction`,
  percent: (q) => `${nameOf(q.fraction)} as a percentage`,
  three_names: (q) => `${nameOf(q.fraction)} — which row is the same number?`,
};

/** A row of the three names, as level 48 shows them. */
export const rowText = (f: Fraction): string =>
  `${decimalText(f.taken, f.parts)} · ${percentOf(f.taken, f.parts)}%`;

export function buildDecimalQuestion(
  setup: DecimalSetup,
  mode: DecimalMode,
  index: number,
  seen?: Set<string>,
): DecimalQuestion {
  const allowed = (setup.denominators ?? TERMINATING).filter((d) => TERMINATING.includes(d));

  const draw = (): DecimalQuestion => {
    const shell = {
      id: "",
      taskKind: `fractions_${mode}`,
      expected: "",
      itemCount: 0,
      mode,
      wants: "decimal" as DecimalQuestion["wants"],
      grid: 10 as DecimalQuestion["grid"],
      options: [] as string[],
    } as DecimalQuestion;

    switch (mode) {
      case "tenths": {
        const taken = randInt(1, 9);
        const f: Fraction = { whole: BAR, parts: 10, taken };
        const expected = decimalText(taken, 10);
        return {
          ...shell,
          fraction: f,
          grid: 10,
          itemCount: 10,
          wants: "decimal",
          expected,
          options: uniqueOptions([
            expected,
            // The digits written straight down, with no thought about place.
            `0.0${taken}`,
            `${taken}.0`,
            `0.${taken}${taken}`,
            String(taken),
          ]),
          id: `fractions-tenths-${index}-${taken}`,
        };
      }

      case "hundredths": {
        // Never a multiple of ten: `40/100` is a tenths question in disguise,
        // and the level before this one already asked it.
        const taken = pick(Array.from({ length: 89 }, (_, i) => i + 10).filter((n) => n % 10 !== 0));
        const f: Fraction = { whole: BAR, parts: 100, taken };
        const expected = decimalText(taken, 100);
        return {
          ...shell,
          fraction: f,
          grid: 100,
          itemCount: 100,
          wants: "decimal",
          expected,
          options: uniqueOptions([
            expected,
            // Only the tens digit kept, which is the place being taught.
            `0.${Math.floor(taken / 10)}`,
            // A place too far down.
            `0.0${taken}`,
            // The point put after the digits rather than before them.
            `${taken}.0`,
          ]),
          id: `fractions-hundredths-${index}-${taken}`,
        };
      }

      case "by_dividing": {
        const parts = pick(allowed.filter((d) => d !== 10));
        const taken = randInt(1, parts - 1);
        const f: Fraction = { whole: BAR, parts, taken };
        const expected = decimalText(taken, parts);
        return {
          ...shell,
          fraction: f,
          grid: "fraction",
          itemCount: parts,
          wants: "decimal",
          expected,
          options: uniqueOptions([
            expected,
            // The two numbers read off as digits — `3/4` as `0.34`, which is
            // what a child writes who has not divided anything.
            `0.${taken}${parts}`,
            // The part left over rather than the part asked for.
            decimalTextSafe(parts - taken, parts),
            // The top or the bottom number alone, straight after the point.
            `0.${taken}`,
            `0.${parts}`,
          ]),
          id: `fractions-by_dividing-${index}-${taken}-${parts}`,
        };
      }

      case "from_decimal": {
        const parts = pick([10, 100]);
        const taken = parts === 10 ? randInt(1, 9) : pick(Array.from({ length: 89 }, (_, i) => i + 10).filter((n) => n % 10 !== 0));
        const raw: Fraction = { whole: BAR, parts, taken };
        const answer = simplify(raw);
        return {
          ...shell,
          fraction: raw,
          grid: parts as DecimalQuestion["grid"],
          itemCount: parts,
          wants: "fraction",
          expected: nameOf(answer),
          options: uniqueOptions([
            nameOf(answer),
            // Not simplified, which is right arithmetic and the wrong answer to
            // a question that asks for the simplest form.
            ...(nameOf(raw) === nameOf(answer) ? [] : [nameOf(raw)]),
            // The wrong power of ten: tenths where hundredths were meant.
            nameOf({ whole: BAR, parts: parts === 10 ? 100 : 10, taken }),
            nameOf({ whole: BAR, parts, taken: taken + 1 }),
            nameOf({ whole: BAR, parts: taken, taken: 1 }),
          ], false),
          id: `fractions-from_decimal-${index}-${taken}-${parts}`,
        };
      }

      case "percent": {
        const parts = pick([2, 4, 5, 10, 20, 25, 50]);
        const taken = randInt(1, parts - 1);
        const f: Fraction = { whole: BAR, parts, taken };
        const value = percentOf(taken, parts);
        return {
          ...shell,
          fraction: f,
          grid: 100,
          itemCount: 100,
          wants: "percent",
          expected: `${value}%`,
          options: uniqueOptions([
            `${value}%`,
            // The numerator read as the percent — `3/4` as `3%`.
            `${taken}%`,
            `${parts}%`,
            `${100 - value}%`,
            `${value / 10 >= 1 ? Math.round(value / 10) : value * 10}%`,
          ], false),
          id: `fractions-percent-${index}-${taken}-${parts}`,
        };
      }

      default: {
        const parts = pick([2, 4, 5, 10, 20, 25]);
        const taken = randInt(1, parts - 1);
        const f: Fraction = { whole: BAR, parts, taken };
        const wrong = (t: number, p: number): string => rowText({ whole: BAR, parts: p, taken: t });
        return {
          ...shell,
          fraction: f,
          grid: 100,
          itemCount: 100,
          wants: "row",
          expected: rowText(f),
          options: uniqueOptions([
            rowText(f),
            // The percent and the decimal swapped round: `0.75 · 75%` against
            // `75 · 0.75%`, which is the commonest way of losing the place.
            `${percentOf(taken, parts)} · ${decimalText(taken, parts)}%`,
            wrong(taken, parts === 2 ? 4 : parts === 25 ? 20 : 2),
            wrong(taken + 1 < parts ? taken + 1 : Math.max(1, taken - 1), parts),
          ], false),
          id: `fractions-three_names-${index}-${taken}-${parts}`,
        };
      }
    }
  };

  const built = seen ? withoutRepeat(draw, (q) => q.id.split("-").slice(3).join("-") + q.mode, seen) : draw();
  return { ...built, prompt: PROMPTS[mode](built as Omit<DecimalQuestion, "prompt">) };
}

/** `decimalText` for a whole number, without the termination check getting in the way. */
const decimalTextSafe = (taken: number, parts: number): string => {
  try {
    return decimalText(taken, parts);
  } catch {
    return String(taken);
  }
};

/** What an answer is worth, so two spellings of one amount can be spotted. */
const amountOf = (text: string): number => {
  if (text.includes("%")) return Number(text.replace("%", "")) / 100;
  if (text.includes("/")) {
    const [top, bottom] = text.split("/").map(Number);
    return top / bottom;
  }
  return Number(text);
};

/** Four answers, no amount written twice — unless the level is about spelling. */
export function uniqueOptions(pool: string[], collapseEqual = true): string[] {
  const out: string[] = [];
  for (const text of pool) {
    if (out.length === 4) break;
    if (!text || /NaN|undefined|-/.test(text)) continue;
    const equal = (seen: string) =>
      seen === text || (collapseEqual && Math.abs(amountOf(seen) - amountOf(text)) < 1e-12);
    if (out.some(equal)) continue;
    out.push(text);
  }
  return shuffle(out);
}

/** Whether an answer is right. Every level here asks for one written form. */
export function isDecimalCorrect(q: DecimalQuestion, given: string): boolean {
  return given === q.expected;
}

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                          */
/* -------------------------------------------------------------------------- */

export function explainDecimal(q: DecimalQuestion, correct: boolean): string {
  const f = q.fraction;

  if (!correct) {
    switch (q.mode) {
      case "tenths":
        return "The first place after the point counts tenths, so the top number goes straight into it.";
      case "hundredths":
        return "Two places after the point means hundredths, and both digits belong in them.";
      case "by_dividing":
        return "Divide the top number by the bottom one. The digits of the fraction are not the answer.";
      case "from_decimal":
        return "Count the places after the point: one is tenths, two is hundredths. Then cut it down.";
      case "percent":
        return "Percent means out of a hundred, so write the fraction with a hundred underneath first.";
      default:
        return "All three names have to be the same amount. Check the decimal against the percent.";
    }
  }

  switch (q.mode) {
    case "tenths":
      return `${f.taken} ${partWord(10, true)} is ${f.taken} in the first place after the point — ${q.expected}.`;
    case "hundredths":
      return `${f.taken} ${partWord(100, true)} fills two places after the point, which is ${q.expected}.`;
    case "by_dividing":
      return `${f.taken} divided by ${f.parts} is ${q.expected}, and it stops rather than running on forever.`;
    case "from_decimal":
      return `That many ${partWord(f.parts, true)} is ${nameOf(f)}, which cuts down to ${q.expected}.`;
    case "percent":
      return `${nameOf(f)} written with a hundred underneath is ${percentOf(f.taken, f.parts)} hundredths — ${q.expected}.`;
    default:
      return `${nameOf(f)}, ${decimalText(f.taken, f.parts)} and ${percentOf(f.taken, f.parts)}% are one number written three ways.`;
  }
}

export { gcd, partWord, simplify, valueOf };
