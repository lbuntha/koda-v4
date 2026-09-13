/**
 * Fractions as numbers, on a line.
 *
 * The strip says a fraction is *part of a thing*. This says it is a *number*,
 * with a place of its own between two whole numbers, and the two ideas together
 * are what let a child compare, add and eventually divide with fractions rather
 * than only shading them.
 *
 * The whole here is always `the number line` — a length from 0 to 1 (or to 2, or
 * 3) rather than a cake — and that changes what a partition means: the line is
 * cut into `parts` *intervals*, and the fraction names the tick at the end of
 * the `taken`th one. Off-by-one between ticks and intervals is the classic way
 * to build this engine wrong, so `tickAt` is the single place it is decided.
 */

import {
  drawFraction,
  partWord,
  fractionKey,
  pick,
  shuffle,
  toMixed,
  valueOf,
  withoutRepeat,
  type Fraction,
  type FractionSpec,
  type Whole,
} from "./fractionNumbers";

export type LineMode =
  /** Drag the marker to `1/d`. */
  | "place_unit"
  /** Drag it to `a/d`. */
  | "place_any"
  /** The marker is on a tick. What is it called? */
  | "read_point"
  /** `d/d` is one whole — and what is missing to reach it. */
  | "makes_one"
  /** Past one: improper fractions have places too. */
  | "improper";

export interface LineSetup {
  mode?: LineMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  /** How many whole numbers the line spans. */
  spanRange?: [number, number];
}

interface ModeDefaults {
  partsRange: [number, number];
  span: number;
}

/**
 * The line is ruled in the denominator, so every tick is a landing place. Twelve
 * intervals across a phone is already tight; past that a child cannot tell two
 * ticks apart, which is the same failure as a circle in sevenths.
 */
const DEFAULTS: Record<LineMode, ModeDefaults> = {
  place_unit: { partsRange: [2, 10], span: 1 },
  place_any: { partsRange: [2, 10], span: 1 },
  read_point: { partsRange: [2, 10], span: 1 },
  makes_one: { partsRange: [2, 12], span: 1 },
  improper: { partsRange: [2, 6], span: 3 },
};

/** The line's own whole: a length, not an object. */
const LINE_WHOLE: Whole = { kind: "number", name: "the number line" };

export interface LineQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: LineMode;
  fraction: Fraction;
  /** How many whole numbers the line runs across. */
  span: number;
  /** How many intervals the line is cut into altogether. */
  intervals: number;
  /** The interval index the answer sits on, counted from zero. */
  tick: number;
  /** True when the child moves a marker; false when it is already placed. */
  placesIt: boolean;
  /** Written options, for the modes answered by naming. */
  options?: string[];
}

/**
 * Which tick a fraction sits on, given how the line is ruled.
 *
 * The one place the tick/interval distinction is decided. A line from 0 to 1 in
 * quarters has five marks and four jumps, and `3/4` is the *fourth mark* —
 * index 3, which is exactly the numerator. Every jump is one `1/parts`, so
 * `taken` jumps land on mark `taken`, and that holds past one as well: `7/4` on
 * a line spanning 0 to 2 is the seventh mark of eight.
 *
 * It read `round(value * intervals)` first, which is the same number only while
 * the span is one — past that it multiplies by the span and puts `7/4` on mark
 * fourteen of eight. A number line that runs off its own end.
 */
export const tickAt = (f: Fraction, span: number): number => f.taken;

export const intervalsFor = (f: Fraction, span: number): number => f.parts * span;

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

const PROMPTS: Record<LineMode, (q: Omit<LineQuestion, "prompt">) => string> = {
  place_unit: (q) => `Put the marker on ${nameOf(q.fraction)}.`,
  place_any: (q) => `Put the marker on ${nameOf(q.fraction)}.`,
  read_point: () => "What number is the marker on?",
  makes_one: (q) => `How many ${partWord(q.fraction.parts, true)} make one whole?`,
  improper: (q) => `Put the marker on ${nameOf(q.fraction)}.`,
};

export function buildLineQuestion(
  setup: LineSetup,
  mode: LineMode,
  index: number,
  seen?: Set<string>,
): LineQuestion {
  const fallback = DEFAULTS[mode];
  const span = setup.spanRange ? pick([setup.spanRange[0], setup.spanRange[1]]) : fallback.span;
  const spec: FractionSpec = {
    partsRange: setup.partsRange ?? fallback.partsRange,
    wholeKinds: ["number"],
    proper: mode === "improper" ? "never" : "always",
    unit: mode === "place_unit" ? "always" : mode === "place_any" ? "never" : "any",
  };

  const draw = (): Fraction => {
    let f = drawFraction(spec);
    /*
     * Past one, but not *on* a whole number.
     *
     * `proper: "never"` happily draws `4/2`, which is two — a whole number
     * wearing a fraction's clothes, and a level about fractions bigger than one
     * that keeps offering one has quietly become a level about something else.
     * Redrawn until the numerator does not divide the denominator.
     */
    for (let i = 0; i < 60 && mode === "improper" && f.taken % f.parts === 0; i += 1) {
      f = drawFraction(spec);
    }
    // The line owns its whole: it is a length, never a cake.
    return { ...f, whole: LINE_WHOLE };
  };
  const fraction = seen ? withoutRepeat(draw, fractionKey, seen) : draw();

  const useSpan = mode === "improper" ? Math.max(span, Math.ceil(valueOf(fraction)) + 0) : span;
  const id = `fractions-${mode}-${index}-${fraction.taken}-${fraction.parts}`;

  const base = {
    id,
    taskKind: `fractions_${mode}`,
    itemCount: fraction.parts,
    mode,
    fraction,
    span: useSpan,
    intervals: intervalsFor(fraction, useSpan),
    tick: tickAt(fraction, useSpan),
    placesIt: mode !== "read_point" && mode !== "makes_one",
    expected: nameOf(fraction),
  };

  if (mode === "makes_one") {
    /*
     * `d/d` is one whole, and a child who has only ever shaded parts has no
     * reason to expect a fraction to *be* a whole number. Answered by naming
     * the fraction rather than by placing it: the point is the name.
     */
    const right = `${fraction.parts}/${fraction.parts}`;
    const wrong = [
      `${fraction.parts - 1}/${fraction.parts}`,
      `${fraction.parts + 1}/${fraction.parts}`,
      `1/${fraction.parts}`,
    ].filter((t) => t !== right);
    return {
      ...base,
      prompt: PROMPTS.makes_one(base as Omit<LineQuestion, "prompt">),
      expected: right,
      tick: base.intervals,
      options: shuffle([right, ...wrong].slice(0, 4)),
    };
  }

  if (mode === "read_point") {
    const wrong = [
      // The two beliefs: the two numbers swapped, and counting ticks instead of
      // intervals — which puts the answer one out in a way that looks careful.
      `${fraction.parts}/${fraction.taken}`,
      `${fraction.taken + 1}/${fraction.parts}`,
      `${fraction.taken}/${fraction.parts + 1}`,
    ];
    return {
      ...base,
      prompt: PROMPTS.read_point(base as Omit<LineQuestion, "prompt">),
      options: shuffle([nameOf(fraction), ...wrong]),
    };
  }

  return { ...base, prompt: PROMPTS[mode](base as Omit<LineQuestion, "prompt">) };
}

/** Why the line will not take an answer yet. */
export type LineBlock = "not-placed" | null;

export function lineBlockedBecause(question: LineQuestion, marker: number | null): LineBlock {
  if (!question.placesIt) return null;
  return marker === null ? "not-placed" : null;
}

export const LINE_REFUSALS: Record<Exclude<LineBlock, null>, string> = {
  "not-placed": "Put the marker on the line first.",
};

/** Where each whole number falls, for labelling the line. */
export const wholeTicks = (question: LineQuestion): number[] =>
  Array.from({ length: question.span + 1 }, (_, i) => i * question.fraction.parts);

export { toMixed };

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                           */
/* -------------------------------------------------------------------------- */

/**
 * The sentence a child reads after answering.
 *
 * "That is where it sits" was one of these, and it is not an explanation — it
 * restates that they were right. Each line below names the jumps, because
 * counting jumps rather than marks is the whole technique and the whole way it
 * goes wrong.
 */
export function explainLine(q: LineQuestion, correct: boolean, given?: string): string {
  const { fraction: f } = q;
  const piece = `one ${partWord(f.parts)}`;

  if (!correct) {
    if (q.mode === "read_point" && given === `${f.parts}/${f.taken}`) {
      return "That is the two numbers the wrong way up. The jumps counted go on top.";
    }
    if (q.mode === "read_point") {
      return "Count the jumps from zero, not the marks. There is always one more mark than jump.";
    }
    if (q.mode === "makes_one") {
      return `Count the jumps from 0 all the way to 1, one ${partWord(f.parts)} at a time.`;
    }
    return `Every jump is ${piece}. Count them from zero, one at a time.`;
  }

  switch (q.mode) {
    case "place_unit":
      return `One jump of ${piece} from zero. That is where 1/${f.parts} lives.`;
    case "place_any":
      return `${f.taken} jumps of ${piece} from zero lands on ${f.taken}/${f.parts}.`;
    case "read_point":
      return `${f.taken} jumps from zero, out of ${f.parts} to reach one — ${f.taken}/${f.parts}.`;
    case "makes_one":
      return `${f.parts} jumps of ${piece} reach exactly 1, so ${f.parts}/${f.parts} is one whole.`;
    default:
      return `${f.taken} jumps of ${piece} carries straight past 1. A fraction can be bigger than one and still be one number.`;
  }
}
