/**
 * Adding and subtracting — counting pieces, once the pieces match.
 *
 * The whole of this engine is one sentence: **you can only add things that are
 * the same size.** Three eighths and two eighths are five eighths because both
 * are eighths; a half and a third are not five sixths *yet*, because a half and
 * a third are not the same thing. Every level here is that sentence at a
 * different stage.
 *
 * Level 27 is the odd one and the important one. It shows the child the wrong
 * answer — `1/2 + 1/3 = 2/5` — and asks them to disprove it on the strip. A
 * misconception that is never stated is never examined, and this one is held by
 * most children at some point and by some adults permanently.
 *
 * The invariant asserted before the engine exists: **a sum is only offered when
 * both fractions name pieces of the same whole**, and the answer is computed
 * from the matched form rather than from the digits.
 */

import {
  gcd,
  lcm,
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

export type AddMode =
  /** Same denominator, adding. */
  | "add_like"
  /** Same denominator, taking away. */
  | "subtract_like"
  /** Shown `1/2 + 1/3 = 2/5` and asked to disprove it. */
  | "refute"
  /** One denominator divides the other. */
  | "add_nested"
  /** Any two denominators, adding. */
  | "add_unlike"
  /** Any two denominators, taking away. */
  | "subtract_unlike"
  /** Whole ones as well, adding. */
  | "add_mixed"
  /** Whole ones as well, and a whole has to be broken. */
  | "subtract_mixed";

export interface AddSetup {
  mode?: AddMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  onesRange?: [number, number];
}

const BAR: Whole = { kind: "bar", name: "the strip" };

interface ModeDefaults {
  partsRange: [number, number];
  onesRange: [number, number];
}

/**
 * Denominators stay small because both fractions have to be *drawn*, and the
 * matched form is drawn too: a third plus a quarter becomes twelfths, and a
 * fifth plus a sixth becomes thirtieths, which no strip on a phone can show.
 * The ceiling is on the common denominator, not on either fraction.
 */
const DEFAULTS: Record<AddMode, ModeDefaults> = {
  add_like: { partsRange: [3, 12], onesRange: [0, 0] },
  subtract_like: { partsRange: [3, 12], onesRange: [0, 0] },
  refute: { partsRange: [2, 4], onesRange: [0, 0] },
  add_nested: { partsRange: [2, 6], onesRange: [0, 0] },
  add_unlike: { partsRange: [2, 6], onesRange: [0, 0] },
  subtract_unlike: { partsRange: [2, 6], onesRange: [0, 0] },
  add_mixed: { partsRange: [2, 6], onesRange: [1, 2] },
  subtract_mixed: { partsRange: [2, 6], onesRange: [1, 3] },
};

/** Nothing is drawn past this many pieces, matched or not. */
export const MAX_COMMON = 24;

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;
export const mixedText = (ones: number, f: Fraction): string =>
  ones === 0 ? nameOf(f) : f.taken === 0 ? String(ones) : `${ones} ${nameOf(f)}`;

export interface AddQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: AddMode;
  /** The two fractions, as written. */
  left: Fraction;
  right: Fraction;
  /** Whole ones in front of each, where the level has them. */
  leftOnes: number;
  rightOnes: number;
  /** Adding or taking away. */
  operation: "add" | "subtract";
  /** The denominator both become when matched. */
  common: number;
  /** The answer, in its simplest written form. */
  answer: { ones: number; fraction: Fraction };
  /** True when the child must match the pieces before answering. */
  mustMatch: boolean;
  /** The claim being disproved, for level 27. */
  claim?: Fraction;
  /** Numeric options, where the answer is chosen. */
  options?: string[];
}

/** The two fractions re-cut so their pieces are the same size. */
export const matchedPair = (q: AddQuestion): { left: Fraction; right: Fraction } => ({
  left: { ...q.left, parts: q.common, taken: q.left.taken * (q.common / q.left.parts) },
  right: { ...q.right, parts: q.common, taken: q.right.taken * (q.common / q.right.parts) },
});

/**
 * The answer, worked the way the lesson teaches.
 *
 * Matched first, then counted — never from the digits. It is the same number
 * either way, and computing it the other way round would let a generator agree
 * with a misconception by accident.
 */
export function answerOf(q: AddQuestion): { ones: number; fraction: Fraction } {
  const m = matchedPair(q);
  const totalParts =
    q.operation === "add"
      ? (q.leftOnes + q.rightOnes) * q.common + m.left.taken + m.right.taken
      : (q.leftOnes - q.rightOnes) * q.common + m.left.taken - m.right.taken;
  const ones = Math.floor(totalParts / q.common);
  const rest = totalParts % q.common;
  const raw: Fraction = { whole: BAR, parts: q.common, taken: rest };
  return { ones, fraction: rest === 0 ? raw : simplify(raw) };
}

export const answerText = (a: { ones: number; fraction: Fraction }): string =>
  a.fraction.taken === 0 ? String(a.ones) : mixedText(a.ones, a.fraction);

const PROMPTS: Record<AddMode, (q: Omit<AddQuestion, "prompt">) => string> = {
  add_like: (q) => `${nameOf(q.left)} + ${nameOf(q.right)}`,
  subtract_like: (q) => `${nameOf(q.left)} − ${nameOf(q.right)}`,
  refute: (q) =>
    `Somebody says ${nameOf(q.left)} + ${nameOf(q.right)} = ${nameOf(q.claim as Fraction)}. Show that it is wrong.`,
  add_nested: (q) => `${nameOf(q.left)} + ${nameOf(q.right)}`,
  add_unlike: (q) => `${nameOf(q.left)} + ${nameOf(q.right)}`,
  subtract_unlike: (q) => `${nameOf(q.left)} − ${nameOf(q.right)}`,
  add_mixed: (q) => `${mixedText(q.leftOnes, q.left)} + ${mixedText(q.rightOnes, q.right)}`,
  subtract_mixed: (q) => `${mixedText(q.leftOnes, q.left)} − ${mixedText(q.rightOnes, q.right)}`,
};

export function buildAddQuestion(
  setup: AddSetup,
  mode: AddMode,
  index: number,
  seen?: Set<string>,
): AddQuestion {
  const fallback = DEFAULTS[mode];
  const [loParts, hiParts] = setup.partsRange ?? fallback.partsRange;
  const [loOnes, hiOnes] = setup.onesRange ?? fallback.onesRange;
  const operation: "add" | "subtract" =
    mode === "subtract_like" || mode === "subtract_unlike" || mode === "subtract_mixed" ? "subtract" : "add";

  /**
   * The two denominators this mode wants.
   *
   * An unlike level must draw unlike denominators — that is the whole level —
   * so when the first denominator has no partner inside the drawing ceiling
   * (nothing pairs with sevenths under twenty-four parts) the *first* one is
   * drawn again. The first version fell back to `[a, a]`, which quietly turned
   * a lesson about matching pieces into a lesson about counting them.
   */
  const denominators = (): [number, number] => {
    if (mode === "add_like" || mode === "subtract_like") {
      const a = randInt(loParts, hiParts);
      return [a, a];
    }
    const all = Array.from({ length: hiParts - loParts + 1 }, (_, i) => loParts + i);
    const partners = (a: number) =>
      all.filter((d) => {
        if (d === a) return false;
        if (lcm(a, d) > MAX_COMMON) return false;
        return mode === "add_nested" ? a % d === 0 || d % a === 0 : true;
      });
    const usable = all.filter((a) => partners(a).length > 0);
    if (usable.length === 0) {
      throw new Error(
        `fractions/${mode}: no two denominators in ${loParts}–${hiParts} match under ${MAX_COMMON} parts`,
      );
    }
    const a = pick(usable);
    return [a, pick(partners(a))];
  };

  const draw = (): AddQuestion => {
    if (mode === "refute") return refuteQuestion(index);

    const [pa, pb] = denominators();
    const common = lcm(pa, pb);
    const step = { a: common / pa, b: common / pb };

    /*
     * Numerators are drawn in their own denominators and compared in matched
     * terms — and where the relationship comes out wrong, they are drawn again.
     *
     * The first version swapped them instead, which is wrong in a way that
     * looks right: a value matched against sixths cannot be written back over
     * thirds, and `1.5/3` came out the other side. Two fractions of different
     * denominators are not interchangeable quantities, which is the same lesson
     * the engine is trying to teach.
     */
    let takenA = randInt(1, pa - 1);
    let takenB = randInt(1, pb - 1);

    let leftOnes = randInt(loOnes, hiOnes);
    let rightOnes = randInt(loOnes, hiOnes);

    const matchedA = () => takenA * step.a;
    const matchedB = () => takenB * step.b;

    /*
     * Half the like-denominator draws stay inside one whole and half cross it,
     * alternating by index so a round shows both. Crossing is the harder half
     * and belongs here — `5/8 + 6/8` is where `11/8` and `1 3/8` turn out to be
     * the same amount, which levels 22 and 23 have just taught.
     *
     * The re-cutting levels stay inside one whole on purpose. Matching the
     * pieces is the new thing there; renaming the total as well would put two
     * unfamiliar steps in one question.
     */
    const withinOne =
      mode === "add_nested" || mode === "add_unlike" || (mode === "add_like" && index % 2 === 0);
    const pastOne = mode === "add_like" && index % 2 === 1;
    if (withinOne || pastOne) {
      const wrong = () =>
        withinOne ? matchedA() + matchedB() > common : matchedA() + matchedB() <= common;
      for (let i = 0; i < 60 && wrong(); i += 1) {
        takenA = randInt(1, pa - 1);
        takenB = randInt(1, pb - 1);
      }
    }

    if (operation === "subtract") {
      if (mode === "subtract_mixed") {
        /*
         * A whole always has to be broken, because that is the technique.
         * The part being taken away is the bigger of the two, and there is
         * always a whole one in front of it to break up.
         */
        for (let i = 0; i < 60 && matchedA() >= matchedB(); i += 1) {
          takenA = randInt(1, pa - 1);
          takenB = randInt(1, pb - 1);
        }
        leftOnes = Math.max(1, leftOnes);
        rightOnes = Math.min(rightOnes, leftOnes - 1);
      } else {
        // Never below zero: a negative answer is a different topic, years away.
        for (let i = 0; i < 60 && matchedA() <= matchedB(); i += 1) {
          takenA = randInt(1, pa - 1);
          takenB = randInt(1, pb - 1);
        }
      }
    }

    const left: Fraction = { whole: BAR, parts: pa, taken: takenA };
    const right: Fraction = { whole: BAR, parts: pb, taken: takenB };

    const shell = {
      id: `fractions-${mode}-${index}-${left.taken}/${left.parts}-${right.taken}/${right.parts}`,
      taskKind: `fractions_${mode}`,
      itemCount: common,
      mode,
      left,
      right,
      leftOnes,
      rightOnes,
      operation,
      common,
      mustMatch: left.parts !== right.parts,
      prompt: "",
      expected: "",
      answer: { ones: 0, fraction: left },
    } as AddQuestion;

    const answer = answerOf(shell);
    const settled = { ...shell, answer, expected: answerText(answer) };
    return { ...settled, options: addOptions(settled) };
  };

  const built = seen
    ? withoutRepeat(draw, (q) => `${q.mode}:${nameOf(q.left)}${q.operation}${nameOf(q.right)}`, seen)
    : draw();
  return { ...built, prompt: PROMPTS[mode](built as Omit<AddQuestion, "prompt">) };
}

/**
 * The level that shows a child the wrong answer.
 *
 * `1/2 + 1/3 = 2/5` is the single commonest error in fractions, and it is
 * plausible: it is what adding looks like if a fraction is a pair of numbers.
 * Naming it and putting it on the strip is the only way to kill it — a
 * misconception nobody states is never examined. The pairs are small and
 * familiar so that the disproof is visible rather than arithmetical: two fifths
 * is plainly less than a half, and the sum is plainly more.
 */
export function refuteQuestion(index: number): AddQuestion {
  const pairs: [number, number][] = [
    [2, 3],
    [2, 4],
    [3, 4],
    [2, 5],
    [3, 6],
  ];
  const [p, q] = pairs[index % pairs.length];
  const left: Fraction = { whole: BAR, parts: p, taken: 1 };
  const right: Fraction = { whole: BAR, parts: q, taken: 1 };
  const common = lcm(p, q);
  const claim: Fraction = { whole: BAR, parts: p + q, taken: 2 };
  const answer = {
    ones: 0,
    fraction: simplify({ whole: BAR, parts: common, taken: common / p + common / q }),
  };
  return {
    id: `fractions-refute-${index}-${p}-${q}`,
    taskKind: "fractions_refute",
    prompt: "",
    expected: answerText(answer),
    itemCount: common,
    mode: "refute",
    left,
    right,
    leftOnes: 0,
    rightOnes: 0,
    operation: "add",
    common,
    answer,
    mustMatch: true,
    claim,
    /*
     * The claim is always on the buttons, because the level is asking the child
     * to turn it down. The rest are the near misses: one of the two pieces on
     * its own, and "two pieces" of the matched size — the same 2 from the top
     * of the claim, now over a denominator that at least means something.
     *
     * Collected with the duplicates removed. The first version shuffled a list
     * of four and sliced it, and `1/2 + 1/4` put `2/4` in twice: React kept one
     * and dropped the other, so that question had three buttons.
     */
    options: uniqueOptions([
      answerText(answer),
      nameOf(claim),
      nameOf({ whole: BAR, parts: common, taken: Math.max(common / p, common / q) }),
      `2/${common}`,
      nameOf({ whole: BAR, parts: common, taken: Math.min(common / p, common / q) }),
    ]),
  };
}

/**
 * What an answer button is worth, as a fraction rather than a decimal.
 *
 * `9/7` and `1 2/7` are the same number and they are not the same `double`:
 * 1.2857142857142858 against 1.2857142857142856. Compared as decimals they
 * looked different, so both went onto the screen, and the child who pressed the
 * improper one was marked wrong for giving the right answer in the other name
 * levels 22 and 23 had just taught them.
 */
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

function uniqueOptions(pool: string[]): string[] {
  const out: string[] = [];
  for (const text of pool) {
    if (out.length === 4) break;
    const { top, bottom } = amountOf(text);
    // Nothing worth nothing or less. "0" is not an answer a child writes to a
    // question about how much is left, and a negative one is years away.
    if (!Number.isFinite(top / bottom) || top <= 0) continue;
    if (out.some((seen) => seen === text || sameAmount(seen, text))) continue;
    out.push(text);
  }
  return shuffle(out);
}

/** Why the strip will not take an answer yet. */
export type AddBlock = "pieces-differ" | null;

/**
 * Adding is counting, and counting needs the pieces to be the same size.
 *
 * Refused rather than marked, because a child who has not matched the pieces has
 * not made a mistake yet — they have not started. Accepting a guess here would
 * confirm exactly the method the level exists to remove.
 */
export function addBlockedBecause(q: AddQuestion, matchedYet: boolean): AddBlock {
  if (!q.mustMatch || matchedYet) return null;
  return "pieces-differ";
}

/**
 * Whether an answer is right, which is a question about the amount.
 *
 * `9/7` and `1 2/7` are one answer. The round asks for the mixed form because
 * that is what the two levels before this one were about, but a child who
 * writes the improper one has added correctly and is told so.
 */
export function isAddCorrect(q: AddQuestion, given: string): boolean {
  return given === q.expected || sameAmount(given, q.expected);
}

export const ADD_REFUSALS: Record<Exclude<AddBlock, null>, string> = {
  "pieces-differ": "These pieces are different sizes. Cut them to match before you count.",
};

export { gcd, lcm, partWord, simplify, valueOf };

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                           */
/* -------------------------------------------------------------------------- */

export function explainAdd(q: AddQuestion, correct: boolean): string {
  const m = matchedPair(q);
  const piece = partWord(q.common, true);
  const sign = q.operation === "add" ? "and" : "take away";

  if (!correct) {
    switch (q.mode) {
      case "refute":
        return "Line the two up on the strip. Together they reach further than the answer being claimed.";
      case "subtract_mixed":
        return "There are not enough loose parts to take that many away. Break a whole one up first.";
      case "add_like":
      case "subtract_like":
        return `Both are ${partWord(q.left.parts, true)} already, so just ${q.operation === "add" ? "count them together" : "count what is left"}.`;
      default:
        return `Cut both to ${piece} first — then they are the same size and can be counted.`;
    }
  }

  switch (q.mode) {
    case "add_like":
      return `${q.left.taken} ${sign} ${q.right.taken} ${partWord(q.left.parts, true)} is ${q.left.taken + q.right.taken} of them — ${q.expected}.`;
    case "subtract_like":
      return `${q.left.taken} ${partWord(q.left.parts, true)} take away ${q.right.taken} leaves ${q.left.taken - q.right.taken} — ${q.expected}.`;
    case "refute":
      return `Cut both to ${piece}: that is ${m.left.taken} and ${m.right.taken}, which makes ${q.expected}. Adding the bottom numbers gives a smaller answer than either piece deserves.`;
    case "subtract_mixed":
      return `A whole one broken up gives ${q.common} more ${piece}, and there is enough to take ${m.right.taken} away — ${q.expected}.`;
    default:
      return `In ${piece} they are ${m.left.taken} and ${m.right.taken}, so the answer is ${q.expected}.`;
  }
}

/* -------------------------------------------------------------------------- */
/* The four answers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The wrong answers are the ones children actually write.
 *
 * Adding across the top *and* the bottom is first, always, because it is the
 * error the whole engine exists to remove and a child who holds it should meet
 * it here rather than discover it uncontested. After that: the right count over
 * the wrong piece size, and the right piece size under the wrong count.
 *
 * They are collected in priority order and only then shuffled, so that a short
 * pool loses the weakest distractor rather than a random one. The division
 * build shipped `20 ÷ 4 = 500` by shuffling first and slicing after.
 */
export function addOptions(q: AddQuestion): string[] {
  const m = matchedPair(q);
  const sign = q.operation === "add" ? 1 : -1;
  const wholes = q.leftOnes + sign * q.rightOnes;

  /** An answer, written the way the buttons write answers. */
  const say = (ones: number, taken: number, parts: number): string =>
    taken === 0 ? String(ones) : ones > 0 ? `${ones} ${taken}/${parts}` : `${taken}/${parts}`;

  const matchedCount = m.left.taken + sign * m.right.taken;

  const pool = [
    q.expected,
    // Both numbers straight across — the misconception, stated. Nonsense for a
    // subtraction that empties the bottom, and dropped below when it is.
    say(wholes, q.left.taken + sign * q.right.taken, q.left.parts + sign * q.right.parts),
    /*
     * The parts subtracted the wrong way round, with no whole broken.
     *
     * `3 1/6 − 2 2/4` becomes `1 1/3` this way: take the smaller count from the
     * larger, whichever side it is on, and leave the wholes alone. It is the
     * single commonest answer to a mixed subtraction and for those levels it is
     * the distractor that matters most.
     */
    say(wholes, Math.abs(m.left.taken - m.right.taken), q.common),
    // Matched correctly, then written over the original piece size. Where the
    // pieces already matched this is the right answer, and drops out.
    say(wholes, matchedCount, q.left.parts),
    // Right piece size, but the raw counts never re-cut.
    say(wholes, q.left.taken + sign * q.right.taken, q.common),
    // The other operation: read the sign wrong and the answer is still tidy.
    say(wholes, m.left.taken - sign * m.right.taken, q.common),
    // One piece out — the ordinary miscount.
    say(wholes, matchedCount + 1, q.common),
    say(wholes, matchedCount - 1, q.common),
    // A whole one too many or too few, for the levels that break one.
    say(q.answer.ones + 1, q.answer.fraction.taken, q.answer.fraction.parts),
    say(Math.max(0, q.answer.ones - 1), q.answer.fraction.taken, q.answer.fraction.parts),
    // Giving up and copying the bigger of the two down. Always available, which
    // is why it is last: some questions have only three plausible wrong answers
    // and a fourth button should still be a thing a child might believe.
    mixedText(q.leftOnes, q.left),
    mixedText(q.rightOnes, q.right),
  ];

  return uniqueOptions(pool.filter((text) => !/-|\/0\b|(^|\s)0\//.test(text)));
}

