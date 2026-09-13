/**
 * The same amount, as loose parts or as wholes and a remainder.
 *
 * `7/4` and `1¾` are one quantity with two notations, and the only way a child
 * comes to believe that is to watch four loose quarters become a whole one
 * without anything being added or taken away. So this engine is built on a
 * single action — group four quarters into a whole, or break a whole back into
 * four quarters — and both directions are the same action run backwards.
 *
 * The invariant, asserted before the engine exists: **the total number of parts
 * never changes**. A board holding one whole and three quarters is holding seven
 * quarters, and if those two ever disagree the level is teaching that two
 * notations happen to be taught together rather than that they are the same
 * number.
 */

import {
  drawFraction,
  partWord,
  fractionKey,
  pick,
  shuffle,
  toImproper,
  toMixed,
  valueOf,
  withoutRepeat,
  type Fraction,
  type FractionSpec,
  type MixedNumber,
  type Whole,
} from "./fractionNumbers";

export type MixedMode =
  /** Loose parts into wholes: `7/4` becomes `1 3/4`. */
  | "to_mixed"
  /** Wholes back into parts: `1 3/4` becomes `7/4`. */
  | "to_improper"
  /** Both names, at one place on a line. */
  | "on_line";

export interface MixedSetup {
  mode?: MixedMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  /** How many whole ones the answer may contain. */
  onesRange?: [number, number];
}

interface ModeDefaults {
  partsRange: [number, number];
  onesRange: [number, number];
}

/**
 * Ceilings set by what the board can show, not by what the arithmetic allows.
 *
 * Four wholes in eighths is thirty-two loose parts, and a child counting those
 * has stopped doing the lesson and started doing a counting exercise.
 */
const DEFAULTS: Record<MixedMode, ModeDefaults> = {
  to_mixed: { partsRange: [2, 6], onesRange: [1, 3] },
  to_improper: { partsRange: [2, 6], onesRange: [1, 3] },
  on_line: { partsRange: [2, 4], onesRange: [1, 3] },
};

export const improperName = (f: Fraction): string => `${f.taken}/${f.parts}`;
export const mixedName = (m: MixedNumber): string =>
  m.taken === 0 ? String(m.ones) : `${m.ones} ${m.taken}/${m.parts}`;

export interface MixedQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: MixedMode;
  /** The one quantity, written both ways. */
  improper: Fraction;
  mixed: MixedNumber;
  /** Which way the child is working. */
  direction: "group" | "break" | "place";
  /** Where the marker goes, for the line mode. */
  tick?: number;
  intervals?: number;
  span?: number;
  /** Written options, where the answer is a name. */
  options?: string[];
}

const PROMPTS: Record<MixedMode, (q: Omit<MixedQuestion, "prompt">) => string> = {
  to_mixed: (q) => `Group these ${partWord(q.improper.parts, true)} into whole ones.`,
  to_improper: (q) => `Break the whole ones back into ${partWord(q.improper.parts, true)}.`,
  on_line: (q) => `Put the marker on ${mixedName(q.mixed)}.`,
};

export function buildMixedQuestion(
  setup: MixedSetup,
  mode: MixedMode,
  index: number,
  seen?: Set<string>,
): MixedQuestion {
  const fallback = DEFAULTS[mode];
  const [loParts, hiParts] = setup.partsRange ?? fallback.partsRange;
  const [loOnes, hiOnes] = setup.onesRange ?? fallback.onesRange;

  const spec: FractionSpec = {
    partsRange: [loParts, hiParts],
    wholeKinds: ["bar"],
    proper: "always",
    excludeTrivial: true,
  };

  /*
   * Drawn as a *proper* fraction and then given whole ones, rather than drawn
   * improper and divided.
   *
   * It guarantees the fractional part is never zero, which matters: `8/4` is a
   * whole number wearing a fraction's clothes, and a level about mixed numbers
   * that keeps offering one is a level about something else.
   */
  const draw = (): Fraction => {
    const part = drawFraction(spec);
    const ones = loOnes + Math.floor(Math.random() * (hiOnes - loOnes + 1));
    return { ...part, taken: ones * part.parts + part.taken };
  };

  const improper = seen ? withoutRepeat(draw, fractionKey, seen) : draw();
  const mixed = toMixed(improper);
  const id = `fractions-${mode}-${index}-${improper.taken}-${improper.parts}`;

  const base = {
    id,
    taskKind: `fractions_${mode}`,
    itemCount: improper.taken,
    mode,
    improper,
    mixed,
    direction:
      mode === "to_mixed" ? ("group" as const) : mode === "to_improper" ? ("break" as const) : ("place" as const),
    expected: mode === "to_improper" ? improperName(improper) : mixedName(mixed),
  };

  if (mode === "on_line") {
    const span = mixed.ones + 1;
    return {
      ...base,
      prompt: PROMPTS.on_line(base as Omit<MixedQuestion, "prompt">),
      tick: improper.taken,
      intervals: improper.parts * span,
      span,
      expected: mixedName(mixed),
    };
  }

  return { ...base, prompt: PROMPTS[mode](base as Omit<MixedQuestion, "prompt">) };
}

/* -------------------------------------------------------------------------- */
/* The board                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What is on the board: some whole ones, and some loose parts.
 *
 * Held as a pair rather than as a fraction so that the *arrangement* is the
 * state. Two boards can hold the same amount and look completely different, and
 * this engine is entirely about moving between those arrangements.
 */
export interface Board {
  ones: number;
  loose: number;
  parts: number;
}

export const boardTotal = (b: Board): number => b.ones * b.parts + b.loose;

/** Group `parts` loose ones into a whole. */
export const groupOne = (b: Board): Board =>
  b.loose >= b.parts ? { ...b, ones: b.ones + 1, loose: b.loose - b.parts } : b;

/** Break one whole back into loose parts. */
export const breakOne = (b: Board): Board =>
  b.ones >= 1 ? { ...b, ones: b.ones - 1, loose: b.loose + b.parts } : b;

export const canGroup = (b: Board): boolean => b.loose >= b.parts;
export const canBreak = (b: Board): boolean => b.ones >= 1;

/** The board a question starts from. */
export const startingBoard = (q: MixedQuestion): Board =>
  q.direction === "group"
    ? { ones: 0, loose: q.improper.taken, parts: q.improper.parts }
    : { ones: q.mixed.ones, loose: q.mixed.taken, parts: q.improper.parts };

/** Why the board is not the answer yet. */
export type MixedBlock = "group-more" | "break-more" | "not-placed" | null;

/**
 * Whether the board is in the arrangement the question asked for.
 *
 * Refused rather than marked, and for the usual reason: a board with five loose
 * quarters on it is not a wrong answer, it is an unfinished one, and the
 * evidence is sitting in front of the child.
 */
export function mixedBlockedBecause(q: MixedQuestion, board: Board): MixedBlock {
  if (q.direction === "group") return canGroup(board) ? "group-more" : null;
  if (q.direction === "break") return board.ones > 0 ? "break-more" : null;
  return null;
}

export const MIXED_REFUSALS: Record<Exclude<MixedBlock, null>, string> = {
  "group-more": "There are still enough loose ones to make another whole.",
  "break-more": "There is still a whole one to break up.",
  "not-placed": "Put the marker on the line first.",
};

export { toImproper, toMixed, valueOf, pick, shuffle };
export type { MixedNumber, Whole };

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                           */
/* -------------------------------------------------------------------------- */

/**
 * The sentence a child reads after answering, and why it is not "Correct".
 *
 * A verdict tells them whether to feel good. An explanation tells them what
 * happened, in the terms of the picture they were just looking at — and it is
 * the only teaching that reaches a child who guessed right, which is a larger
 * group than anybody likes. Exported rather than inlined in the component so a
 * test can walk every technique and check that each one actually says
 * something.
 */
export function explainMixed(q: MixedQuestion, correct: boolean): string {
  const { improper: f, mixed: m } = q;
  const piece = partWord(f.parts, true);
  if (!correct) {
    switch (q.direction) {
      case "group":
        return `Keep grouping while ${f.parts} loose ${piece} are still left.`;
      case "break":
        return `Every whole one you break gives you ${f.parts} more ${piece}.`;
      default:
        return `Count on in ${piece} past the whole numbers.`;
    }
  }
  switch (q.direction) {
    case "group":
      return `${f.taken} ${piece} makes ${m.ones} whole ${m.ones === 1 ? "one" : "ones"} and ${m.taken} left over — ${mixedName(m)}.`;
    case "break":
      return `${m.ones} whole ${m.ones === 1 ? "one" : "ones"} is ${m.ones * f.parts} ${piece}, and ${m.taken} more makes ${f.taken}.`;
    default:
      return `${mixedName(m)} and ${improperName(f)} are the same place on the line.`;
  }
}
