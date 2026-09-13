/**
 * What the folding strip asks, and when it will take an answer.
 *
 * Six techniques on one apparatus, and they differ only in what is fixed and
 * what the child supplies: the parts, how many are shaded, or the name for what
 * they see. That is a data decision, so it lives here and a test can ask
 * "does `name_unit` ever shade more than one part?" without mounting a strip.
 */

import {
  WHOLES,
  partWord,
  canPartition,
  drawFraction,
  fractionDistractors,
  fractionKey,
  partitionsFor,
  pick,
  randInt,
  shuffle,
  withoutRepeat,
  type Fraction,
  type FractionSpec,
  type Whole,
} from "./fractionNumbers";

export type StripMode =
  /** Are these parts the same size? */
  | "equal_or_not"
  /** One part is shaded. What is it called? */
  | "name_unit"
  /** The same fraction of two different wholes. Which is more? */
  | "which_whole"
  /** Shade this many copies of the unit fraction. */
  | "build"
  /** Read the picture as `a/b`. */
  | "to_notation"
  /** A fraction of a set of things. */
  | "of_a_set";

export interface StripSetup {
  mode?: StripMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  partsRange?: [number, number];
  wholeKinds?: Whole["kind"][];
}

interface ModeDefaults {
  partsRange: [number, number];
  wholeKinds: Whole["kind"][];
}

/**
 * Ranges chosen so the picture stays readable rather than so the fractions stay
 * easy. Twelve is the ceiling because a bar in thirteenths on a phone has parts
 * a child cannot tell apart, and this engine's whole job is that they can.
 */
const DEFAULTS: Record<StripMode, ModeDefaults> = {
  equal_or_not: { partsRange: [2, 8], wholeKinds: ["bar", "circle"] },
  name_unit: { partsRange: [2, 12], wholeKinds: ["bar", "circle"] },
  which_whole: { partsRange: [2, 6], wholeKinds: ["bar"] },
  build: { partsRange: [3, 12], wholeKinds: ["bar", "circle"] },
  to_notation: { partsRange: [2, 12], wholeKinds: ["bar", "circle"] },
  of_a_set: { partsRange: [2, 6], wholeKinds: ["set"] },
};

export interface StripQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: StripMode;
  fraction: Fraction;
  /** How many parts the child must end up having shaded. */
  target: number;
  /** True when the child shades; false when the picture is given. */
  shadesIt: boolean;
  /** Parts drawn deliberately unequal, for the level about equal parts. */
  unequal?: number[];
  /** Whether those parts are in fact equal. */
  areEqual?: boolean;
  /** The second whole, for the level that compares two. */
  other?: Fraction;
  /** Which one holds more, for that level. */
  bigger?: "left" | "right";
  /** Written options, where the answer is a name rather than a number. */
  options?: string[];
  /** Numeric options, where it is a count. */
  choices?: number[];
}

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

/**
 * Parts that are visibly not the same size.
 *
 * Returned as widths rather than a flag so the picture is the evidence: a child
 * answering "no" should be able to point at which one is wrong, and a strip that
 * merely *claims* to be unequal teaches them to read the question instead of the
 * picture.
 */
export function unequalWidths(parts: number): number[] {
  const even = 1 / parts;
  const widths = Array.from({ length: parts }, () => even);
  const fat = randInt(0, parts - 1);
  let thin = randInt(0, parts - 1);
  if (thin === fat) thin = (fat + 1) % parts;
  widths[fat] = even * 1.6;
  widths[thin] = even * 0.4;
  return widths;
}

const PROMPTS: Record<StripMode, (q: Omit<StripQuestion, "prompt">) => string> = {
  equal_or_not: () => "Are all the parts the same size?",
  name_unit: (q) => `One part of ${q.fraction.whole.name} is shaded. What is it called?`,
  which_whole: (q) => `Both are ${nameOf(q.fraction)} shaded. Which is more?`,
  build: (q) => `Shade ${q.target} of the ${q.fraction.parts} parts.`,
  to_notation: (q) => `What fraction of ${q.fraction.whole.name} is shaded?`,
  of_a_set: (q) => `What is ${nameOf(q.fraction)} of ${q.fraction.whole.name}?`,
};

export function buildStripQuestion(
  setup: StripSetup,
  mode: StripMode,
  index: number,
  seen?: Set<string>,
): StripQuestion {
  const fallback = DEFAULTS[mode];
  const spec: FractionSpec = {
    partsRange: setup.partsRange ?? fallback.partsRange,
    wholeKinds: setup.wholeKinds ?? fallback.wholeKinds,
    proper: "always",
    unit: mode === "name_unit" ? "always" : mode === "to_notation" ? "never" : "any",
  };

  const draw = () => drawFraction(spec);
  const fraction = seen ? withoutRepeat(draw, fractionKey, seen) : draw();
  const id = `fractions-${mode}-${index}-${fraction.taken}-${fraction.parts}`;

  const base = {
    id,
    taskKind: `fractions_${mode}`,
    itemCount: fraction.parts,
    mode,
    fraction,
    target: fraction.taken,
    shadesIt: mode === "build",
    expected: nameOf(fraction),
  };

  if (mode === "equal_or_not") {
    /*
     * Half the round is equal and half is not, and the unequal half is drawn
     * with real widths. A round where every answer is "no" teaches a child to
     * answer without looking, and so does one where every answer is "yes".
     */
    const areEqual = index % 2 === 0;
    return {
      ...base,
      prompt: PROMPTS.equal_or_not(base as Omit<StripQuestion, "prompt">),
      expected: areEqual ? "yes" : "no",
      areEqual,
      unequal: areEqual ? undefined : unequalWidths(fraction.parts),
      target: 0,
    };
  }

  if (mode === "which_whole") {
    /*
     * The same fraction of two different-sized wholes.
     *
     * Level 3's whole point: "one half" is not an amount until somebody says
     * half of what. The two strips are drawn at visibly different lengths, and
     * the fraction shaded is identical.
     */
    const other: Fraction = { ...fraction, whole: { ...fraction.whole, name: "the short ribbon", size: 1 } };
    return {
      ...base,
      prompt: PROMPTS.which_whole(base as Omit<StripQuestion, "prompt">),
      expected: "left",
      other,
      bigger: "left",
      target: 0,
    };
  }

  if (mode === "of_a_set") {
    const size = fraction.whole.size ?? 12;
    const answer = (size / fraction.parts) * fraction.taken;
    /*
     * Four distinct counts, and the near misses are the ones a child reaches
     * for: the number of groups rather than the size of one, and what is left
     * when they take the wrong part. Built from a pool because the obvious four
     * collide — a third of twelve is four, and so is the number left when you
     * take two thirds of six.
     */
    const pool = [
      answer,
      size / fraction.parts,
      size - answer,
      fraction.parts,
      answer + 1,
      Math.max(1, answer - 1),
      size,
    ];
    const choices: number[] = [];
    for (const n of pool) {
      if (n > 0 && Number.isInteger(n) && !choices.includes(n)) choices.push(n);
      if (choices.length === 4) break;
    }
    return {
      ...base,
      prompt: PROMPTS.of_a_set(base as Omit<StripQuestion, "prompt">),
      expected: String(answer),
      choices: shuffle(choices),
      target: answer,
    };
  }

  if (mode === "name_unit" || mode === "to_notation") {
    const wrong = fractionDistractors(fraction, 3).map((d) => nameOf(d.value));
    return {
      ...base,
      prompt: PROMPTS[mode](base as Omit<StripQuestion, "prompt">),
      options: shuffle([nameOf(fraction), ...wrong]),
      target: fraction.taken,
    };
  }

  return { ...base, prompt: PROMPTS.build(base as Omit<StripQuestion, "prompt">) };
}

/** Why the strip will not take an answer yet. `null` means it will. */
export type StripBlock = "shade-more" | "shade-fewer" | null;

/**
 * The strip has to be shaded before it is named.
 *
 * Only `build` gates: it is the level where the child makes the fraction rather
 * than reads one, and a child who answers from the prompt alone has done no
 * building. Refused rather than marked, because too few parts shaded is an
 * unfinished picture and not a wrong one.
 */
export function stripBlockedBecause(question: StripQuestion, shaded: number): StripBlock {
  if (!question.shadesIt) return null;
  if (shaded < question.target) return "shade-more";
  if (shaded > question.target) return "shade-fewer";
  return null;
}

export const STRIP_REFUSALS: Record<Exclude<StripBlock, null>, string> = {
  "shade-more": "Shade more of them — count how many the question asked for.",
  "shade-fewer": "That is too many. Take one off.",
};

/** Every whole this engine can draw, for a test that wants to walk them. */
export const drawableWholes = (kinds: Whole["kind"][]): Whole[] =>
  WHOLES.filter((w) => kinds.includes(w.kind) && partitionsFor(w).length > 0);

export { canPartition };

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                           */
/* -------------------------------------------------------------------------- */

/**
 * The sentence a child reads after answering.
 *
 * Never "Correct" and never "That is the answer" — both of those tell a child
 * whether to feel good and nothing else, and the child who guessed right is
 * left exactly where they started. Every line below says *what happened*, in the
 * terms of the picture that is still on screen.
 *
 * Exported rather than written inside the component so that a test can walk
 * every technique and check each one actually explains something. Two of these
 * were "That is the answer." until somebody read them.
 */
export function explainStrip(q: StripQuestion, correct: boolean, given?: string): string {
  const { fraction: f } = q;
  const size = f.whole.size ?? 12;
  const perGroup = size / f.parts;

  if (!correct) {
    switch (q.mode) {
      case "equal_or_not":
        return "Compare two parts side by side. If one is wider than another, the split is not fair.";
      case "name_unit":
        return `Count the parts the whole is cut into — there are ${f.parts}. One of them is one ${partWord(f.parts)}.`;
      case "which_whole":
        return "The same fraction is shaded on both. What differs is how big each whole was to start with.";
      case "to_notation":
        return given && given.startsWith(String(f.parts))
          ? "That is the two numbers the wrong way up. The shaded parts go on top."
          : "Count the shaded parts for the top number, and all of them for the bottom.";
      case "of_a_set":
        return `Split the ${size} into ${f.parts} equal groups first — that is ${perGroup} in each.`;
      default:
        return "Shade one part at a time and count as you go.";
    }
  }

  switch (q.mode) {
    case "equal_or_not":
      return q.areEqual
        ? "Every part is the same size, so each one really is one of that many equal parts."
        : "The parts are different sizes, so they are not fractions of this whole at all.";
    case "name_unit":
      return `The whole is cut into ${f.parts} equal parts, so one of them is one ${partWord(f.parts)} — 1/${f.parts}.`;
    case "which_whole":
      return "Same fraction, different whole. A fraction is not an amount until you say what it is a fraction of.";
    case "build":
      return `${f.taken} copies of 1/${f.parts} is ${f.taken}/${f.parts}. One number, not two.`;
    case "to_notation":
      return `${f.taken} parts shaded out of ${f.parts} altogether — ${f.taken}/${f.parts}.`;
    default:
      return `${size} split into ${f.parts} groups is ${perGroup} in each, and ${f.taken} ${f.taken === 1 ? "group" : "groups"} is ${perGroup * f.taken}.`;
  }
}
