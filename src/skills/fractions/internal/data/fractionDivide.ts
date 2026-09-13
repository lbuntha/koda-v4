/**
 * Dividing — which is measuring, not sharing, for most of these levels.
 *
 * "How many halves fit in three?" is a question a six-year-old can answer with
 * their hands, and it is the same question as `3 ÷ 1/2`. That is the whole
 * teaching order here: the measuring picture first, the notation second, and
 * the rule about flipping last — at level 42, once the picture has answered the
 * question five different ways and the rule has something to explain.
 *
 * The answer to `3 ÷ 1/2` is six, and the fact that six is *bigger* than three
 * is the thing children refuse to believe. It is the mirror of level 37, and it
 * is why `measure` comes before anything written: nobody argues with a strip.
 *
 * Two different meanings of division live in these five levels and they are not
 * interchangeable:
 *
 *   `3 ÷ 1/2` asks how many halves fit in three — measuring.
 *   `3/4 ÷ 3` asks for three equal shares of three quarters — sharing.
 *
 * Every question carries which one it is, because a picture drawn for the wrong
 * meaning is a picture of a different question.
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

export type DivideMode =
  /** How many of this unit fraction fit inside a whole number. */
  | "measure"
  /** A whole number divided by a fraction. */
  | "whole_by"
  /** A fraction shared between a whole number of people. */
  | "by_whole"
  /** A fraction divided by a fraction. */
  | "by_fraction"
  /** Which multiplication asks the same question — the rule, explained. */
  | "explain_flip";

/** Measuring out, or sharing between. They are different questions. */
export type DivisionSense = "measure" | "share";

export interface DivideSetup {
  mode?: DivideMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  wholeRange?: [number, number];
  sharesRange?: [number, number];
}

const BAR: Whole = { kind: "bar", name: "the strip" };

const DEFAULTS: Record<DivideMode, Required<Pick<DivideSetup, "partsRange" | "wholeRange" | "sharesRange">>> = {
  measure: { partsRange: [2, 6], wholeRange: [2, 5], sharesRange: [2, 6] },
  whole_by: { partsRange: [2, 6], wholeRange: [2, 6], sharesRange: [2, 6] },
  by_whole: { partsRange: [2, 8], wholeRange: [2, 6], sharesRange: [2, 5] },
  by_fraction: { partsRange: [2, 6], wholeRange: [2, 5], sharesRange: [2, 6] },
  explain_flip: { partsRange: [2, 6], wholeRange: [2, 5], sharesRange: [2, 6] },
};

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

export interface DivideQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: DivideMode;
  /** Which question is being asked: how many fit, or how big is a share. */
  sense: DivisionSense;
  /** The amount being divided up. */
  whole?: number;
  dividend?: Fraction;
  /** What it is being divided by. */
  divisor?: Fraction;
  shares?: number;
  /** The answer as a quantity. */
  answer: { ones: number; fraction: Fraction };
  /** True while the strip still has to be marked before an answer counts. */
  mustMark: boolean;
  options: string[];
}

/** How an answer is written: "6", "1 1/2", "3/8". */
export function amountText(ones: number, f: Fraction): string {
  if (f.taken === 0) return String(ones);
  return ones === 0 ? nameOf(f) : `${ones} ${nameOf(f)}`;
}

/** An improper fraction split into whole ones and what is left over. */
export function asMixed(f: Fraction): { ones: number; fraction: Fraction } {
  const ones = Math.floor(f.taken / f.parts);
  const rest = f.taken % f.parts;
  return { ones, fraction: rest === 0 ? { ...f, taken: 0 } : simplify({ ...f, taken: rest }) };
}

/** `a/b ÷ c/d`, worked as a quantity. */
export function quotientOf(a: Fraction, b: Fraction): { ones: number; fraction: Fraction } {
  return asMixed(simplify({ whole: BAR, parts: a.parts * b.taken, taken: a.taken * b.parts }));
}

const PROMPTS: Record<DivideMode, (q: Omit<DivideQuestion, "prompt">) => string> = {
  measure: (q) => `How many ${partWord((q.divisor as Fraction).parts, true)} fit in ${q.whole}?`,
  whole_by: (q) => `${q.whole} ÷ ${nameOf(q.divisor as Fraction)}`,
  by_whole: (q) => `${nameOf(q.dividend as Fraction)} shared between ${q.shares}`,
  by_fraction: (q) => `${nameOf(q.dividend as Fraction)} ÷ ${nameOf(q.divisor as Fraction)}`,
  explain_flip: (q) =>
    `${nameOf(q.dividend as Fraction)} ÷ ${nameOf(q.divisor as Fraction)} — which multiplication asks the same thing?`,
};

export function buildDivideQuestion(
  setup: DivideSetup,
  mode: DivideMode,
  index: number,
  seen?: Set<string>,
): DivideQuestion {
  const fallback = DEFAULTS[mode];
  const [loParts, hiParts] = setup.partsRange ?? fallback.partsRange;
  const [loWhole, hiWhole] = setup.wholeRange ?? fallback.wholeRange;
  const [loShares, hiShares] = setup.sharesRange ?? fallback.sharesRange;

  const draw = (): DivideQuestion => {
    const shell = {
      id: "",
      taskKind: `fractions_${mode}`,
      expected: "",
      itemCount: 0,
      mode,
      sense: "measure" as DivisionSense,
      mustMark: false,
      answer: { ones: 0, fraction: { whole: BAR, parts: 2, taken: 1 } },
      options: [] as string[],
    } as DivideQuestion;

    switch (mode) {
      case "measure": {
        const parts = randInt(Math.max(2, loParts), hiParts);
        const whole = randInt(loWhole, hiWhole);
        const value = whole * parts;
        return {
          ...shell,
          sense: "measure",
          whole,
          divisor: { whole: BAR, parts, taken: 1 },
          itemCount: value,
          mustMark: true,
          answer: { ones: value, fraction: { whole: BAR, parts, taken: 0 } },
          expected: String(value),
          options: uniqueOptions([
            String(value),
            // The two numbers multiplied the other way round is the same, so the
            // near misses are the ones that forget a whole or an extra piece.
            String(value - parts),
            String(value + parts),
            String(whole + parts),
            String(parts),
          ]),
          id: `fractions-measure-${index}-${whole}-in-${parts}`,
        };
      }

      case "whole_by": {
        /*
         * Constructed so the answer lands on a whole number.
         *
         * `4 ÷ 2/3` is six, and the picture is four strips cut into thirds and
         * grouped in twos. `4 ÷ 3/5` is six and two thirds, which is a true
         * answer to a question this level is not asking — it cannot be grouped
         * off the strip, and a child who counts the leftover as "two thirds of
         * a group" is doing level 41's work.
         */
        const parts = randInt(Math.max(2, loParts), hiParts);
        const taken = pick(divisorsOf(parts).filter((d) => d < parts));
        const groups = randInt(2, 4);
        const whole = (taken * groups) / parts >= 1 ? (taken * groups) / parts : 0;
        const chosenWhole = whole >= 1 && Number.isInteger(whole) ? whole : randInt(loWhole, hiWhole);
        const value = (chosenWhole * parts) / taken;
        const divisor: Fraction = { whole: BAR, parts, taken };
        return {
          ...shell,
          sense: "measure",
          whole: chosenWhole,
          divisor,
          itemCount: chosenWhole * parts,
          answer: { ones: value, fraction: { whole: BAR, parts, taken: 0 } },
          expected: String(value),
          options: uniqueOptions([
            String(value),
            // Multiplied by the fraction instead of divided by it — the answer
            // a child gives who believes dividing always makes things smaller.
            amountText(...mixedParts(simplify({ whole: BAR, parts, taken: chosenWhole * taken }))),
            String(value - 1),
            String(value + 1),
            String(chosenWhole * parts),
          ]),
          id: `fractions-whole_by-${index}-${chosenWhole}-by-${taken}/${parts}`,
        };
      }

      case "by_whole": {
        /*
         * Sharing, not measuring: three quarters between three people.
         *
         * The answer is a smaller fraction of the same whole, and the picture is
         * the bar cut again — which is why the numerator does not have to divide
         * by the number of people. `3/4 ÷ 2` is `3/8`: cut each quarter in two.
         */
        const parts = randInt(Math.max(2, loParts), hiParts);
        const taken = randInt(1, parts - 1);
        const shares = randInt(loShares, hiShares);
        const dividend: Fraction = { whole: BAR, parts, taken };
        const answer = simplify({ whole: BAR, parts: parts * shares, taken });
        return {
          ...shell,
          sense: "share",
          dividend,
          shares,
          itemCount: parts * shares,
          answer: { ones: 0, fraction: answer },
          expected: nameOf(answer),
          options: uniqueOptions([
            nameOf(answer),
            // Shared the top instead of cutting the pieces.
            nameOf({ whole: BAR, parts, taken: Math.max(1, Math.round(taken / shares)) }),
            // Multiplied instead of shared.
            nameOf(simplify({ whole: BAR, parts, taken: Math.min(parts - 1, taken * shares) })),
            nameOf({ whole: BAR, parts: parts + shares, taken }),
            nameOf({ whole: BAR, parts: parts * shares, taken: taken * shares }),
            /*
             * One piece out, either way.
             *
             * `1/2 shared between 2` collapses every method-shaped distractor:
             * sharing the top, multiplying instead, and cutting once too often
             * all land on `1/2` or on the answer itself. These two are the
             * ordinary miscount, and they survive.
             */
            nameOf({ whole: BAR, parts: parts * shares, taken: taken + 1 }),
            nameOf({ whole: BAR, parts: parts * shares, taken: Math.max(1, taken - 1) }),
            // Cut once too often: every piece halved a second time.
            nameOf({ whole: BAR, parts: parts * shares * 2, taken }),
          ]),
          id: `fractions-by_whole-${index}-${taken}/${parts}-between-${shares}`,
        };
      }

      case "by_fraction":
      case "explain_flip": {
        const parts = randInt(Math.max(2, loParts), hiParts);
        const taken = randInt(1, parts - 1);
        const dparts = randInt(Math.max(2, loParts), hiParts);
        const dtaken = randInt(1, dparts - 1);
        const dividend: Fraction = { whole: BAR, parts, taken };
        const divisor: Fraction = { whole: BAR, parts: dparts, taken: dtaken };
        const answer = quotientOf(dividend, divisor);
        const written = amountText(answer.ones, answer.fraction);
        const flipped = `${nameOf(dividend)} × ${divisor.parts}/${divisor.taken}`;
        return {
          ...shell,
          sense: "measure",
          dividend,
          divisor,
          itemCount: parts * dparts,
          answer,
          expected: mode === "explain_flip" ? flipped : written,
          options:
            mode === "explain_flip"
              ? uniqueOptions(
                  [
                    flipped,
                    // Multiplied without flipping anything.
                    `${nameOf(dividend)} × ${nameOf(divisor)}`,
                    // Flipped the wrong one.
                    `${dividend.parts}/${dividend.taken} × ${nameOf(divisor)}`,
                    // Flipped both.
                    `${dividend.parts}/${dividend.taken} × ${divisor.parts}/${divisor.taken}`,
                  ],
                  false,
                )
              : uniqueOptions([
                  written,
                  // Multiplied straight across instead of flipping.
                  nameOf(simplify({ whole: BAR, parts: parts * dparts, taken: taken * dtaken })),
                  // Flipped the first one rather than the second.
                  amountText(...mixedParts(simplify({ whole: BAR, parts: taken * dtaken, taken: parts * dparts }))),
                  nameOf(dividend),
                  nameOf(divisor),
                ]),
          id: `fractions-${mode}-${index}-${nameOf(dividend)}-by-${nameOf(divisor)}`,
        };
      }
    }
  };

  const built = seen ? withoutRepeat(draw, (q) => `${q.mode}:${q.id.split("-").slice(3).join("-")}`, seen) : draw();
  return { ...built, prompt: PROMPTS[mode](built as Omit<DivideQuestion, "prompt">) };
}

/** Whole ones and what is left, as the pair `amountText` takes. */
function mixedParts(f: Fraction): [number, Fraction] {
  const { ones, fraction } = asMixed(f);
  return [ones, fraction];
}

/** Every number that divides this one, smallest first. */
export function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= n; d += 1) if (n % d === 0) out.push(d);
  return out;
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
  if (/[×]/.test(a) || /[×]/.test(b)) return a === b;
  const x = amountOf(a);
  const y = amountOf(b);
  return x.top * y.bottom === y.top * x.bottom;
};

/** Four answers, no amount written twice. */
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

/** Whether an answer is right, which is a question about the amount. */
export function isDivideCorrect(q: DivideQuestion, given: string): boolean {
  if (given === q.expected) return true;
  // Level 42 asks which multiplication is the same question. There, the written
  // form is the answer: there is nothing to be worth.
  if (q.mode === "explain_flip") return false;
  return sameAmount(given, q.expected);
}

/** Why the strip will not take an answer yet. */
export type DivideBlock = "mark-the-strip" | null;

/**
 * The strip is marked before anything is counted.
 *
 * `How many halves fit in three?` is a question about a picture, and a child
 * who answers before making the picture has guessed at a number-fact. Refused
 * rather than marked wrong, because nothing has been attempted.
 */
export function divideBlockedBecause(q: DivideQuestion, marked: boolean): DivideBlock {
  if (!q.mustMark || marked) return null;
  return "mark-the-strip";
}

export const DIVIDE_REFUSALS: Record<Exclude<DivideBlock, null>, string> = {
  "mark-the-strip": "Mark the strip into those pieces first, then count how many there are.",
};

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                          */
/* -------------------------------------------------------------------------- */

export function explainDivide(q: DivideQuestion, correct: boolean): string {
  const divisor = q.divisor as Fraction;
  const dividend = q.dividend as Fraction;

  if (!correct) {
    switch (q.mode) {
      case "measure":
        return `Each whole one holds ${divisor.parts} of them, so count those pieces across every whole one.`;
      case "whole_by":
        return "Cut every whole one into those pieces, then see how many groups of that size you can make.";
      case "by_whole":
        return "Sharing cuts each piece up again, so the pieces get smaller and there are more of them.";
      case "explain_flip":
        return "Dividing by a fraction asks how many fit inside, and that is multiplying by it upside down.";
      default:
        return "Ask how many of the second one fit inside the first. That is what the sign means.";
    }
  }

  switch (q.mode) {
    case "measure":
      return `Each whole one holds ${divisor.parts} ${partWord(divisor.parts, true)}, and there are ${q.whole} whole ones — ${q.expected} altogether.`;
    case "whole_by":
      return `Cut the ${q.whole} into ${partWord(divisor.parts, true)} and group them ${divisor.taken} at a time: that makes ${q.expected} groups.`;
    case "by_whole":
      return `Each ${partWord(dividend.parts)} cut into ${q.shares} makes ${partWord(dividend.parts * (q.shares as number))}, so each share is ${q.expected}.`;
    case "explain_flip":
      return `Asking how many ${nameOf(divisor)} fit inside is the same as multiplying by it upside down — ${q.expected}.`;
    default: {
      // Under one is the case that needs saying out loud: a divisor bigger than
      // the amount does not fit even once, and "0.89 times" is a sentence a
      // child will read as a mistake unless somebody names it.
      const under = valueOf(dividend) < valueOf(divisor);
      return under
        ? `${nameOf(divisor)} is the bigger of the two, so it does not fit even once — only ${q.expected} of the way.`
        : `Cut both into the same-sized pieces and ${nameOf(divisor)} fits inside ${nameOf(dividend)} ${q.expected} times.`;
    }
  }
}

export { gcd, partWord, simplify, valueOf };
