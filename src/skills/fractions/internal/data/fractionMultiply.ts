/**
 * Multiplying — which is "of", and which usually makes things smaller.
 *
 * Three ideas sit under these five levels, and they are not the same idea:
 *
 *   `2/3 of 18` is sharing eighteen into three and taking two of the parts.
 *   `4 × 2/5` is four copies of two fifths, which is repeated addition.
 *   `2/3 × 3/4` is two thirds *of* three quarters, which is a piece of a piece.
 *
 * A child who learns "multiply the tops and multiply the bottoms" can do all
 * three and understand none. So each has its own picture, and the rule is only
 * named at level 36 — after the grid has shown three times over why it works.
 *
 * Level 37 is the one that matters most and the one usually skipped: after four
 * years of multiplication making numbers bigger, `3/4 × 8` is smaller than 8.
 * A child who has not been made to predict that will read every wrong answer
 * later as a slip rather than as a misunderstanding.
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

export type MultiplyMode =
  /** `a/b` of a whole amount, coming out exact. */
  | "of_whole"
  /** `n × a/b`, shown as repeated addition first. */
  | "whole_times"
  /** `a/b × c/d` on a grid — the overlap is the answer. */
  | "area_model"
  /** The same, with a factor to cancel across the diagonal first. */
  | "simplify_first"
  /** Bigger, smaller or the same — predicted before anything is worked out. */
  | "scaling";

export interface MultiplySetup {
  mode?: MultiplyMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  /** For `of_whole`: how big the amount being shared can be. */
  totalRange?: [number, number];
  /** For `whole_times`: how many copies. */
  copiesRange?: [number, number];
}

const BAR: Whole = { kind: "bar", name: "the strip" };

/** Nothing is drawn on a grid wider or taller than this. */
export const MAX_GRID = 8;

const DEFAULTS: Record<MultiplyMode, Required<Pick<MultiplySetup, "partsRange" | "totalRange" | "copiesRange">>> = {
  of_whole: { partsRange: [2, 6], totalRange: [12, 60], copiesRange: [2, 8] },
  whole_times: { partsRange: [2, 8], totalRange: [12, 60], copiesRange: [2, 8] },
  area_model: { partsRange: [2, 5], totalRange: [12, 60], copiesRange: [2, 8] },
  simplify_first: { partsRange: [2, 8], totalRange: [12, 60], copiesRange: [2, 8] },
  scaling: { partsRange: [2, 8], totalRange: [4, 24], copiesRange: [2, 8] },
};

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

/** Bigger, smaller, or exactly the same — level 37's three answers. */
export type Scaling = "bigger" | "smaller" | "same";

export interface MultiplyQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: MultiplyMode;
  /** The fraction doing the multiplying. */
  fraction: Fraction;
  /** What it is being applied to: an amount, a count of copies, or a fraction. */
  total?: number;
  copies?: number;
  other?: Fraction;
  /** The answer as a quantity, for the modes that produce one. */
  answer?: { ones: number; fraction: Fraction };
  /** Level 37's verdict. */
  verdict?: Scaling;
  /** True while the grid still has to be shaded both ways. */
  mustShade: boolean;
  options: string[];
}

/** `a/b × c/d`, worked as a quantity and written in simplest form. */
export function productOf(a: Fraction, b: Fraction): Fraction {
  return simplify({ whole: BAR, parts: a.parts * b.parts, taken: a.taken * b.taken });
}

/** How the answer is written: "3", "1 3/5", "3/8". */
export function amountText(ones: number, f: Fraction): string {
  if (f.taken === 0) return String(ones);
  return ones === 0 ? nameOf(f) : `${ones} ${nameOf(f)}`;
}

/** An improper fraction split into whole ones and what is left. */
export function asMixed(f: Fraction): { ones: number; fraction: Fraction } {
  const ones = Math.floor(f.taken / f.parts);
  const rest = f.taken % f.parts;
  return { ones, fraction: rest === 0 ? { ...f, taken: 0 } : simplify({ ...f, taken: rest }) };
}

const PROMPTS: Record<MultiplyMode, (q: Omit<MultiplyQuestion, "prompt">) => string> = {
  of_whole: (q) => `${nameOf(q.fraction)} of ${q.total}`,
  whole_times: (q) => `${q.copies} × ${nameOf(q.fraction)}`,
  area_model: (q) => `${nameOf(q.fraction)} of ${nameOf(q.other as Fraction)}`,
  simplify_first: (q) => `${nameOf(q.fraction)} × ${nameOf(q.other as Fraction)}`,
  scaling: (q) =>
    `Is ${nameOf(q.fraction)} × ${q.total} bigger than ${q.total}, smaller, or exactly the same?`,
};

export function buildMultiplyQuestion(
  setup: MultiplySetup,
  mode: MultiplyMode,
  index: number,
  seen?: Set<string>,
): MultiplyQuestion {
  const fallback = DEFAULTS[mode];
  const [loParts, hiParts] = setup.partsRange ?? fallback.partsRange;
  const [loTotal, hiTotal] = setup.totalRange ?? fallback.totalRange;
  const [loCopies, hiCopies] = setup.copiesRange ?? fallback.copiesRange;

  /** A proper fraction in the level's range. */
  const properFraction = (lo = loParts, hi = hiParts): Fraction => {
    const parts = randInt(Math.max(2, lo), hi);
    return { whole: BAR, parts, taken: randInt(1, parts - 1) };
  };

  const draw = (): MultiplyQuestion => {
    const shell = {
      id: "",
      taskKind: `fractions_${mode}`,
      expected: "",
      itemCount: 0,
      mode,
      fraction: properFraction(),
      mustShade: false,
      options: [] as string[],
    } as MultiplyQuestion;

    switch (mode) {
      case "of_whole": {
        /*
         * The amount has to divide by the bottom number exactly.
         *
         * "Two thirds of 20" is a real question with a fractional answer, and
         * this is not the level for it: the picture here is the amount actually
         * split into equal groups, and a group of six-and-two-thirds counters
         * cannot be drawn. Constructed rather than filtered — a rejection loop
         * on a range this wide spends most of its attempts failing.
         */
        const f = properFraction();
        const groups = randInt(Math.ceil(loTotal / f.parts), Math.floor(hiTotal / f.parts));
        const total = f.parts * Math.max(1, groups);
        const value = (total / f.parts) * f.taken;
        return {
          ...shell,
          fraction: f,
          total,
          itemCount: total,
          answer: { ones: value, fraction: { ...f, taken: 0 } },
          expected: String(value),
          options: uniqueOptions([
            String(value),
            // One group instead of the number of groups asked for.
            String(total / f.parts),
            // The part left behind rather than the part taken.
            String(total - value),
            // The whole amount, untouched.
            String(total),
            // One group too many.
            String(value + total / f.parts),
            /*
             * Multiplied by the bottom number instead of divided by it.
             *
             * Halves collapse almost every distractor above — one group, the
             * part left over and the answer are all the same number — so the
             * pool needs a candidate that survives `1/2 of 18`. This one does,
             * and it is a real answer: three years of "times makes bigger".
             */
            String(total * f.parts),
            String(total + total / f.parts),
          ]),
          id: `fractions-of_whole-${index}-${f.taken}/${f.parts}-of-${total}`,
        };
      }

      case "whole_times": {
        const f = properFraction();
        const copies = randInt(loCopies, hiCopies);
        const product: Fraction = { whole: BAR, parts: f.parts, taken: f.taken * copies };
        const answer = asMixed(product);
        const expected = amountText(answer.ones, answer.fraction);
        return {
          ...shell,
          fraction: f,
          copies,
          itemCount: copies,
          answer,
          expected,
          options: uniqueOptions([
            expected,
            // Multiplied the bottom number as well — the copies stayed the size
            // of the original, which is what "times" usually does to a number.
            nameOf({ ...f, parts: f.parts * copies, taken: f.taken * copies }),
            // One copy too many, or one too few.
            amountText(...Object.values(asMixed({ ...product, taken: product.taken + f.taken })) as [number, Fraction]),
            amountText(...Object.values(asMixed({ ...product, taken: Math.max(1, product.taken - f.taken) })) as [number, Fraction]),
            nameOf(product),
          ]),
          id: `fractions-whole_times-${index}-${copies}x${f.taken}/${f.parts}`,
        };
      }

      case "area_model":
      case "simplify_first": {
        const [a, b] = mode === "simplify_first" ? cancellablePair(loParts, hiParts) : [properFraction(2, Math.min(hiParts, MAX_GRID)), properFraction(2, Math.min(hiParts, MAX_GRID))];
        const product = productOf(a, b);
        const expected = nameOf(product);
        return {
          ...shell,
          fraction: a,
          other: b,
          itemCount: a.parts * b.parts,
          answer: { ones: 0, fraction: product },
          expected,
          mustShade: mode === "area_model",
          options: uniqueOptions([
            expected,
            /*
             * The unsimplified product — right working, stopped one step early.
             *
             * A distractor at level 36, where cancelling first is the technique
             * and produces the simplest form on its own. Not offered at level
             * 35, where the child reads the answer straight off the grid: "six
             * of the twelve squares" is what the picture says, and a question
             * with two true answers on it is a trap, not a test.
             */
            ...(mode === "simplify_first"
              ? [nameOf({ whole: BAR, parts: a.parts * b.parts, taken: a.taken * b.taken })]
              : []),
            // Added instead of multiplied, which is what the word "and" invites.
            nameOf(simplify({ whole: BAR, parts: a.parts * b.parts, taken: a.taken * b.parts + b.taken * a.parts })),
            // Crossed the wrong way: tops with bottoms.
            nameOf({ whole: BAR, parts: a.taken * b.parts, taken: a.parts * b.taken }),
            nameOf(a),
            nameOf(b),
          ], mode !== "simplify_first"),
          id: `fractions-${mode}-${index}-${nameOf(a)}x${nameOf(b)}`,
        };
      }

      case "scaling": {
        /*
         * All three verdicts have to be real, so the multiplier is drawn to be
         * less than one, exactly one, or more than one on purpose. A level that
         * only ever draws proper fractions teaches "multiplying makes smaller",
         * which is the same mistake with the sign flipped.
         */
        const kind: Scaling = ["smaller", "same", "bigger"][index % 3] as Scaling;
        const parts = randInt(2, hiParts);
        const taken = kind === "smaller" ? randInt(1, parts - 1) : kind === "same" ? parts : randInt(parts + 1, parts * 2);
        const f: Fraction = { whole: BAR, parts, taken };
        const total = randInt(loTotal, hiTotal);
        return {
          ...shell,
          fraction: f,
          total,
          itemCount: total,
          verdict: kind,
          expected: kind,
          options: ["bigger", "smaller", "same"],
          id: `fractions-scaling-${index}-${nameOf(f)}-of-${total}`,
        };
      }
    }
  };

  const built = seen
    ? withoutRepeat(draw, (q) => `${q.mode}:${q.prompt || q.id}`, seen)
    : draw();
  return { ...built, prompt: PROMPTS[mode](built as Omit<MultiplyQuestion, "prompt">) };
}

/**
 * Two fractions with a factor to cancel across the diagonal.
 *
 * `3/4 × 8/9` — the 4 and the 8 share a 4 — is the level. Built outward from
 * the shared factor so that every draw has one, rather than drawn at random and
 * filtered: a random pair shares a diagonal factor rarely, and the first version
 * of this function fell back to a fixed `3/4 × 8/9` whenever the constraints
 * missed. It missed on 176 draws out of 300, so a child doing level 36 twice saw
 * the same question most of the way through both rounds.
 *
 * The first denominator is chosen, the second numerator is made a multiple of
 * it, and everything else follows. Nothing is rejected, so nothing repeats
 * except by the ordinary luck of a small pool.
 */
export function cancellablePair(lo: number, hi: number): [Fraction, Fraction] {
  const ceiling = Math.max(4, hi);
  // The first denominator, which is also the factor that will cancel. It has to
  // leave room for a numerator above it in the second fraction.
  const usable = Array.from({ length: ceiling - 1 }, (_, i) => i + 2).filter(
    (p) => p >= Math.max(2, lo) && p < ceiling,
  );
  const p = pick(usable.length > 0 ? usable : [2]);

  // How many of those the second fraction's numerator is worth: one p, or two,
  // whichever still leaves a denominator to sit under it.
  const multiples = [1, 2, 3].filter((t) => p * t < ceiling);
  const topB = p * pick(multiples.length > 0 ? multiples : [1]);

  const a: Fraction = { whole: BAR, parts: p, taken: randInt(1, p - 1) };
  const b: Fraction = { whole: BAR, parts: randInt(topB + 1, ceiling), taken: topB };
  return [a, b];
}

/** Where the two shadings overlap on a `rows × columns` grid. */
export function overlapCells(a: Fraction, b: Fraction): { rows: number; columns: number; cells: number } {
  return { rows: b.parts, columns: a.parts, cells: a.taken * b.taken };
}

/** What an answer is worth, as a fraction — decimals lose `9/7` against `1 2/7`. */
const amountOf = (text: string): { top: number; bottom: number } => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return { top: Number(ones) + Number(frac), bottom: 1 };
  const [top, bottom] = frac.split("/").map(Number);
  return { top: Number(ones) * bottom + top, bottom };
};

/** The same quantity, whichever way it is written. */
export const sameAmount = (a: string, b: string): boolean => {
  const x = amountOf(a);
  const y = amountOf(b);
  return x.top * y.bottom === y.top * x.bottom;
};

/**
 * Four answers, each written once and — usually — each worth something else.
 *
 * Two buttons worth the same amount is a question with two right answers, so
 * they are collapsed by default. Level 36 is the exception and asks for them:
 * `24/36` next to `2/3` is the level's whole point, because stopping before the
 * cancelling is the mistake it exists to catch.
 */
export function uniqueOptions(pool: string[], collapseEqual = true): string[] {
  const out: string[] = [];
  for (const text of pool) {
    if (out.length === 4) break;
    if (/-|\/0\b|^0(\/|$)/.test(text)) continue;
    if (out.some((seen) => seen === text || (collapseEqual && sameAmount(seen, text)))) continue;
    out.push(text);
  }
  return shuffle(out);
}

/**
 * Whether an answer is right — which, on the grid, is a question about amount.
 *
 * Level 35 asks a child to count the squares shaded twice, and six twelfths is
 * what they will have counted. Insisting on `1/2` there would mark the reading
 * of the picture wrong for not also doing level 16's job. Everywhere else the
 * written form is the point, so the string has to match.
 */
export function isCorrectAnswer(q: MultiplyQuestion, given: string): boolean {
  if (given === q.expected) return true;
  // Level 36 asks for the cancelled form specifically: `24/36` is the answer of
  // somebody who did not do the level, so there the spelling is the answer.
  if (q.mode === "simplify_first") return false;
  return sameAmount(given, q.expected);
}

/** Why the grid will not take an answer yet. */
export type MultiplyBlock = "shade-across" | "shade-down" | null;

/**
 * Both shadings before any answer.
 *
 * The whole point of the grid is that the answer is *visible* — the overlap is
 * the product, and a child who has not made the overlap has not seen it. This
 * is a refusal rather than a wrong mark for the same reason the strip refuses
 * an unmatched sum: nothing has been attempted yet.
 */
export function multiplyBlockedBecause(
  q: MultiplyQuestion,
  across: boolean,
  down: boolean,
): MultiplyBlock {
  if (!q.mustShade) return null;
  if (!across) return "shade-across";
  if (!down) return "shade-down";
  return null;
}

export const MULTIPLY_REFUSALS: Record<Exclude<MultiplyBlock, null>, string> = {
  "shade-across": "Shade the first fraction across the grid before you answer.",
  "shade-down": "Now shade the second one down the grid. The answer is where they cross.",
};

export { gcd, partWord, simplify, valueOf };

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                          */
/* -------------------------------------------------------------------------- */

export function explainMultiply(q: MultiplyQuestion, correct: boolean): string {
  const { fraction: f, other, total, copies } = q;

  if (!correct) {
    switch (q.mode) {
      case "of_whole":
        return `Share the ${total} into ${f.parts} equal groups first, then take ${f.taken} of those groups.`;
      case "whole_times":
        return "The pieces stay the same size however many copies there are, so only the count goes up.";
      case "area_model":
        return "Count only the squares shaded both ways, out of every square in the grid.";
      case "simplify_first":
        return "Cancel the shared factor across the diagonal first, then multiply the small numbers.";
      default:
        return "Compare the multiplying fraction with one whole. Less than one takes a part of the amount away.";
    }
  }

  switch (q.mode) {
    case "of_whole": {
      const per = (total as number) / f.parts;
      return `${total} shared into ${f.parts} groups is ${per} in each, and ${f.taken} of those groups is ${q.expected}.`;
    }
    case "whole_times":
      return `${copies} copies of ${f.taken} ${partWord(f.parts, true)} is ${(copies as number) * f.taken} of them, which is ${q.expected}.`;
    case "area_model":
      return `${f.taken * (other as Fraction).taken} squares are shaded both ways out of ${f.parts * (other as Fraction).parts}, which is ${q.expected}.`;
    case "simplify_first":
      return `Cancelling across the diagonal first leaves small numbers to multiply, and they give ${q.expected}.`;
    default:
      return q.verdict === "smaller"
        ? `${nameOf(f)} is less than one whole, so taking that much of ${total} leaves less than ${total}.`
        : q.verdict === "same"
          ? `${nameOf(f)} is exactly one whole, so the amount is untouched.`
          : `${nameOf(f)} is more than one whole, so there is more here than the ${total} you started with.`;
  }
}
