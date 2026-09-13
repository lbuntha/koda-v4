/**
 * The same amount, wearing a different name.
 *
 * Five techniques on one action: cut every part into smaller ones, or join them
 * back up. The shaded region does not move while that happens, and *that* is the
 * lesson — a child who has watched 3/4 become 6/8 without the shading changing
 * has seen why the two are equal, rather than been told a rule about multiplying
 * top and bottom.
 *
 * So one invariant governs this whole module and is asserted before any engine
 * exists: **every transform preserves the value**. A "split" that changed the
 * amount shaded would be a different fraction with a straight face.
 */

import {
  equivalentsOf,
  fractionKey,
  fractionDistractors,
  gcd,
  drawFraction,
  pick,
  shuffle,
  simplify,
  valueOf,
  withoutRepeat,
  type Fraction,
  type FractionSpec,
} from "./fractionNumbers";

export type MillMode =
  /** Cut every part into k smaller ones and read the new name. */
  | "split"
  /** Two bars, the same amount shaded, cut differently. */
  | "two_names"
  /** Make an equivalent fraction with a given denominator. */
  | "scale_up"
  /** Divide top and bottom by a factor they share — not necessarily the biggest. */
  | "scale_down"
  /** All the way down: divide by the highest common factor. */
  | "simplest";

export interface MillSetup {
  mode?: MillMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  /** How far a split or a scale may go. */
  factorRange?: [number, number];
}

interface ModeDefaults {
  partsRange: [number, number];
  factorRange: [number, number];
}

/**
 * Ceilings chosen so the picture survives the transform.
 *
 * A bar in sixths split by four is a bar in twenty-fourths, and at the width a
 * phone gives it the parts stop being distinguishable — which is the same
 * failure as a circle in sevenths, arriving one step later. So the *result* is
 * capped, not the starting fraction.
 */
const DEFAULTS: Record<MillMode, ModeDefaults> = {
  split: { partsRange: [2, 6], factorRange: [2, 4] },
  two_names: { partsRange: [2, 6], factorRange: [2, 4] },
  scale_up: { partsRange: [2, 6], factorRange: [2, 5] },
  scale_down: { partsRange: [4, 12], factorRange: [2, 4] },
  simplest: { partsRange: [4, 12], factorRange: [2, 6] },
};

/** Nothing is drawn past this many parts, however it got there. */
export const MAX_PARTS = 24;

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

export interface MillQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: MillMode;
  /** What the child starts with. */
  from: Fraction;
  /** What it becomes. */
  to: Fraction;
  /** The factor connecting them: a multiplier splitting, a divisor joining. */
  factor: number;
  /** True when the child works the mill; false when both pictures are given. */
  operates: boolean;
  /** Written options, where the answer is a name. */
  options?: string[];
}

const PROMPTS: Record<MillMode, (q: Omit<MillQuestion, "prompt">) => string> = {
  split: (q) => `Cut every part into ${q.factor}. What is it called now?`,
  two_names: () => "Which pair of names does this amount have?",
  scale_up: (q) => `Write ${nameOf(q.from)} in ${q.to.parts}ths.`,
  scale_down: (q) => `Both numbers divide by ${q.factor}. What does ${nameOf(q.from)} become?`,
  simplest: (q) => `Write ${nameOf(q.from)} as simply as it will go.`,
};

export function buildMillQuestion(
  setup: MillSetup,
  mode: MillMode,
  index: number,
  seen?: Set<string>,
): MillQuestion {
  const fallback = DEFAULTS[mode];
  const [lo, hi] = setup.factorRange ?? fallback.factorRange;

  const spec: FractionSpec = {
    partsRange: setup.partsRange ?? fallback.partsRange,
    wholeKinds: ["bar"],
    proper: "always",
    // The two reducing levels need something left to reduce.
    simplified: mode === "scale_down" || mode === "simplest" ? "never" : "any",
  };

  const draw = () => drawFraction(spec);
  const from = seen ? withoutRepeat(draw, fractionKey, seen) : draw();

  if (mode === "scale_down" || mode === "simplest") {
    /*
     * Reducing, so the factor must be one the fraction actually has.
     *
     * `simplest` uses the highest common factor by definition. `scale_down`
     * takes any shared factor — which is the point of separating them: a child
     * who cancels a 2 out of 12/18 has done something correct and unfinished,
     * and level 15 is where that is allowed before level 16 asks for all of it.
     */
    const g = gcd(from.taken, from.parts);
    const shared = Array.from({ length: g }, (_, i) => i + 1).filter((k) => k > 1 && g % k === 0);
    const factor = mode === "simplest" ? g : pick(shared.length > 0 ? shared : [g]);
    const to: Fraction = { ...from, parts: from.parts / factor, taken: from.taken / factor };
    const base = {
      id: `fractions-${mode}-${index}-${from.taken}-${from.parts}`,
      taskKind: `fractions_${mode}`,
      itemCount: from.parts,
      mode,
      from,
      to,
      factor,
      operates: true,
      expected: nameOf(to),
    };
    return { ...base, prompt: PROMPTS[mode](base as Omit<MillQuestion, "prompt">) };
  }

  // Splitting. Cap the factor so the result stays drawable.
  const room = Math.floor(MAX_PARTS / from.parts);
  const factor = Math.max(2, Math.min(pick(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)), room));
  const to: Fraction = { ...from, parts: from.parts * factor, taken: from.taken * factor };

  const base = {
    id: `fractions-${mode}-${index}-${from.taken}-${from.parts}-x${factor}`,
    taskKind: `fractions_${mode}`,
    itemCount: to.parts,
    mode,
    from,
    to,
    factor,
    operates: mode !== "two_names",
    expected: nameOf(to),
  };

  if (mode === "two_names") {
    const truth = `${nameOf(from)} and ${nameOf(to)}`;
    const [near] = fractionDistractors(to, 1);
    const wrong = [
      // Added, not multiplied — the commonest wrong way to make an equivalent.
      `${nameOf(from)} and ${from.taken + factor}/${from.parts + factor}`,
      // Only the bottom multiplied.
      `${nameOf(from)} and ${from.taken}/${to.parts}`,
      `${nameOf(from)} and ${nameOf(near.value)}`,
    ];
    return {
      ...base,
      prompt: PROMPTS.two_names(base as Omit<MillQuestion, "prompt">),
      expected: truth,
      operates: false,
      options: shuffle([truth, ...wrong].filter((t, i, a) => a.indexOf(t) === i).slice(0, 4)),
    };
  }

  if (mode === "scale_up") {
    return {
      ...base,
      prompt: PROMPTS.scale_up(base as Omit<MillQuestion, "prompt">),
    };
  }

  return { ...base, prompt: PROMPTS.split(base as Omit<MillQuestion, "prompt">) };
}

/** Why the mill will not take an answer yet. */
export type MillBlock = "not-there-yet" | "went-past" | "not-simplest" | null;

/**
 * Whether the fraction on the board is the one the question asked for.
 *
 * `simplest` gets its own refusal, and it is the reason level 16 is separate
 * from level 15: a child who stops at 6/9 has made a true equivalent and an
 * unfinished answer. "That is equal, but it can still go simpler" is the
 * teaching; a cross would say only that they were wrong.
 */
export function millBlockedBecause(question: MillQuestion, current: Fraction): MillBlock {
  if (valueOf(current) !== valueOf(question.from)) {
    return current.parts > question.to.parts ? "went-past" : "not-there-yet";
  }
  if (question.mode === "simplest" && gcd(current.taken, current.parts) > 1) return "not-simplest";
  if (current.parts !== question.to.parts) {
    return current.parts > question.to.parts ? "went-past" : "not-there-yet";
  }
  return null;
}

export const MILL_REFUSALS: Record<Exclude<MillBlock, null>, string> = {
  "not-there-yet": "Not there yet — keep going.",
  "went-past": "That has gone past it. Come back one step.",
  "not-simplest": "That is an equal fraction, but it can still be made simpler.",
};

/** The splits and joins the mill offers, given where the child is now. */
export function movesFor(current: Fraction): { split: number[]; join: number[] } {
  const split = [2, 3, 4].filter((k) => current.parts * k <= MAX_PARTS);
  const join = [2, 3, 4].filter((k) => current.parts % k === 0 && current.taken % k === 0 && current.parts / k >= 2);
  return { split, join };
}

export const applySplit = (f: Fraction, k: number): Fraction => ({
  ...f,
  parts: f.parts * k,
  taken: f.taken * k,
});

export const applyJoin = (f: Fraction, k: number): Fraction => ({
  ...f,
  parts: f.parts / k,
  taken: f.taken / k,
});

export { equivalentsOf, simplify, valueOf };
