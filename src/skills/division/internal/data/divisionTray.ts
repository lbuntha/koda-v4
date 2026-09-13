/**
 * What the dealing tray asks, and how it decides an answer is right.
 *
 * Pure, and separate from `ShareTray.tsx`, for the reason the plan gives: the
 * five techniques on this engine differ only in what is fixed and what is
 * counted — the number of plates, the size of a plate, or which of those the
 * question wants back. That is a data decision, and putting it here means a
 * test can ask "does `group_by_size` ever fix the plate count?" without
 * mounting anything.
 */

import {
  drawQuotient,
  pick,
  quotientDistractors,
  quotientKey,
  satisfiesQuotient,
  withoutRepeat,
  type Meaning,
  type Quotient,
  type QuotientSpec,
} from "./divisionNumbers";

/* -------------------------------------------------------------------------- */
/* Modes                                                                       */
/* -------------------------------------------------------------------------- */

export type ShareMode =
  /** Deal a total between a fixed number of plates. The answer is a plate. */
  | "share_out"
  /** Fill plates of a fixed size until the pile is gone. The answer is a count of plates. */
  | "group_by_size"
  /** Name the unknown in a worded situation, without working it out. */
  | "which_meaning"
  /** Read a finished deal and choose the sentence that says it. */
  | "to_equation"
  /** Deal between two. The answer is a plate. */
  | "halve"
  /** Divide by one, and by itself. Both shapes appear in every round. */
  | "identity"
  /** Nothing shared out, and the share that cannot be done. */
  | "zero_rules"
  /** Deal until no more can go round, and notice what is left. */
  | "see_leftover";

export interface ShareSetup {
  mode?: ShareMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  /** How many plates, where the mode fixes them. */
  divisorRange?: [number, number];
  /** How many on a plate. */
  quotientRange?: [number, number];
  /** A ceiling on the pile, so a tray stays countable on a phone. */
  totalMax?: number;
  meaning?: Meaning;
}

interface ModeDefaults {
  divisorRange: [number, number];
  quotientRange: [number, number];
  totalMax: number;
  meaning?: Meaning;
}

/**
 * Where each mode draws from when a lesson says nothing.
 *
 * Kept per mode rather than per lesson so that an activity opened with no
 * lesson at all — the picker preview, a test, a developer poking at it — still
 * opens a playable, sensible question. Ranges are small: every one of these
 * modes puts real objects on a screen a child holds in one hand, and thirty
 * counters is already a crowd.
 */
const DEFAULTS: Record<ShareMode, ModeDefaults> = {
  share_out: { divisorRange: [2, 5], quotientRange: [2, 6], totalMax: 30, meaning: "share" },
  group_by_size: { divisorRange: [2, 6], quotientRange: [2, 6], totalMax: 36, meaning: "group" },
  which_meaning: { divisorRange: [2, 6], quotientRange: [2, 8], totalMax: 48 },
  to_equation: { divisorRange: [2, 6], quotientRange: [2, 8], totalMax: 48 },
  halve: { divisorRange: [2, 2], quotientRange: [2, 10], totalMax: 20, meaning: "share" },
  // Both ends open to one: `n / 1` has a divisor of one and `n / n` a quotient
  // of one, and those are the only two shapes this mode draws.
  identity: { divisorRange: [1, 10], quotientRange: [1, 10], totalMax: 20, meaning: "share" },
  zero_rules: { divisorRange: [2, 6], quotientRange: [0, 0], totalMax: 12, meaning: "share" },
  see_leftover: { divisorRange: [2, 5], quotientRange: [2, 6], totalMax: 30, meaning: "share" },
};

/**
 * The tray's shape for a mode.
 *
 * `plates` fixed means the child cannot add or remove one — they are dealing
 * between a known number of people. `capacity` fixed means each plate holds a
 * known amount and the child decides how many plates there are. Exactly one of
 * the two is fixed in any dealing mode, and that is the whole difference
 * between sharing and grouping.
 */
export interface TrayShape {
  /** Number of plates, when the mode fixes it. */
  plates?: number;
  /** How many one plate holds, when the mode fixes it. */
  capacity?: number;
  /**
   * A place for what will not go round again.
   *
   * Only level 8 has one. Before it, every question comes out even and a bin
   * would be a box a child never uses; after it, the bin is where the remainder
   * becomes a thing you can see rather than a letter in a notation they have
   * not met yet.
   */
  leftoverBin?: boolean;
}

export const trayShapeFor = (question: ShareQuestion): TrayShape => {
  switch (question.mode) {
    case "share_out":
    case "halve":
    case "identity":
      return { plates: question.divisor };
    case "see_leftover":
      return { plates: question.divisor, leftoverBin: true };
    case "zero_rules":
      // The impossible one has no tray at all: there is nothing to share into.
      return question.impossible ? {} : { plates: question.divisor };
    case "group_by_size":
      return { capacity: question.divisor };
    default:
      return {};
  }
};

/* -------------------------------------------------------------------------- */
/* A question                                                                  */
/* -------------------------------------------------------------------------- */

/** What the child is being asked to find, in the words the tray uses. */
export type Unknown = "size" | "count";

export interface ShareQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: ShareMode;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  meaning: Meaning;
  /** What the question wants back. */
  unknown: Unknown;
  /** The numeric answer, for the dealing modes. */
  answer: number;
  /** Numeric options, for the modes answered by choosing. */
  choices?: number[];
  /** Equation options, for `to_equation`. */
  equations?: string[];
  /** The situation, for the modes that carry one. */
  story?: StoryLine;
  /** One colour for every counter in this question. */
  tone: Tone;
  /**
   * The question with no answer: `n ÷ 0`.
   *
   * Not a hard question — a question that is not asking anything. It is never
   * drawn by `drawQuotient`, because it is not a division: the judge refuses a
   * divisor below one, and so does this engine. It is *constructed*, offered
   * once or twice a round beside the ordinary `0 ÷ n`, and its right answer is
   * a button that says it cannot be done.
   */
  impossible?: boolean;
}

export type Tone = "sky" | "violet" | "emerald" | "rose";

/** The one place a tone becomes a colour. Shared so two engines cannot drift. */
export const TONE_CLASS: Record<Tone, string> = {
  sky: "bg-sky-400",
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
  rose: "bg-rose-400",
};

const TONES: readonly Tone[] = ["sky", "violet", "emerald", "rose"] as const;

/**
 * A situation, in the two shapes that are the point of this engine.
 *
 * One noun, one container word and one verb per situation, so that the
 * *sentence* carries the difference rather than the picture: "shared between 4
 * plates" and "put into plates of 4" use the same objects and the same number,
 * and only the preposition tells a child which question they are looking at.
 * That is the discrimination level 3 is testing, and it cannot be tested with
 * two different pictures.
 */
export interface StoryLine {
  text: string;
  /** What the situation leaves unknown. */
  unknown: Unknown;
}

interface Subject {
  /** Plural noun for the things being divided. */
  things: string;
  /** Plural noun for what they go into or onto. */
  holders: string;
  /** Singular of `holders`, for the sentence that names one. */
  holder: string;
}

const SUBJECTS: readonly Subject[] = [
  { things: "apples", holders: "plates", holder: "plate" },
  { things: "marbles", holders: "jars", holder: "jar" },
  { things: "stickers", holders: "books", holder: "book" },
  { things: "pencils", holders: "pots", holder: "pot" },
  { things: "cherries", holders: "bowls", holder: "bowl" },
  { things: "shells", holders: "buckets", holder: "bucket" },
] as const;

export const storyFor = (
  subject: Subject,
  value: Quotient,
  unknown: Unknown,
): StoryLine =>
  unknown === "size"
    ? {
        text: `${value.dividend} ${subject.things} are shared equally between ${value.divisor} ${subject.holders}.`,
        unknown,
      }
    : {
        text: `${value.dividend} ${subject.things} are put into ${subject.holders} of ${value.divisor}.`,
        unknown,
      };

/**
 * Which meaning a mode is asking about.
 *
 * `share_out` and `halve` deal a total between a known number of holders, so
 * the answer is a group size. `group_by_size` fills holders of a known size, so
 * the answer is a count of holders. The two remaining modes carry a situation
 * and take the meaning from it.
 */
export const unknownFor = (mode: ShareMode, meaning: Meaning): Unknown => {
  if (
    mode === "share_out" ||
    mode === "halve" ||
    mode === "identity" ||
    mode === "zero_rules" ||
    mode === "see_leftover"
  ) {
    return "size";
  }
  if (mode === "group_by_size") return "count";
  return meaning === "share" ? "size" : "count";
};

const PROMPTS: Record<ShareMode, (q: Omit<ShareQuestion, "prompt">) => string> = {
  share_out: (q) =>
    `Share all ${q.dividend} between the ${q.divisor} ${q.story ? "holders" : "plates"}. How many on each?`,
  halve: (q) => `Share all ${q.dividend} between the 2 plates. How many on each?`,
  group_by_size: (q) => `Make groups of ${q.divisor}. How many groups can you make?`,
  which_meaning: () => "What is this question asking for?",
  to_equation: () => "Which sentence says what happened?",
  identity: (q) =>
    q.divisor === 1
      ? `Put all ${q.dividend} onto the 1 plate. How many are on it?`
      : `Share all ${q.dividend} between the ${q.divisor} plates. How many on each?`,
  zero_rules: (q) =>
    q.impossible
      ? `Can you share ${q.dividend} between 0 plates?`
      : `There is nothing to share. How many does each of the ${q.divisor} plates get?`,
  see_leftover: (q) =>
    `Share as many as you can between the ${q.divisor} plates. How many on each?`,
};

/**
 * Four sentences, one of them true.
 *
 * The wrong three are the named mistakes from `divisionNumbers`, written out as
 * equations: the roles swapped, a place lost, a neighbour miscounted. A wrong
 * option that is merely a different number teaches a child to compare the
 * options with each other; a wrong option that is *their own likely error*
 * makes them look back at the tray.
 */
export function equationOptions(value: Quotient): string[] {
  const truth = `${value.dividend} ÷ ${value.divisor} = ${value.quotient}`;
  const wrong = quotientDistractors(value, 2).map(
    (d) => `${value.dividend} ÷ ${value.divisor} = ${d.value}`,
  );
  // The roles swapped is the misconception this level exists to catch, so it is
  // always offered rather than drawn.
  const swapped = `${value.divisor} ÷ ${value.dividend} = ${value.quotient}`;
  return [truth, swapped, ...wrong];
}

/** Deterministic order, so options do not slide under a finger on a re-render. */
export function orderBySeed<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = (): number => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build question `index` for this lesson.
 *
 * `seen` is the round's repeat guard, passed in rather than owned here so that
 * a test can ask for ten questions and get ten different ones exactly as a
 * round does.
 */
/**
 * The shapes that are constructed rather than drawn.
 *
 * `n ÷ 1`, `n ÷ n` and `0 ÷ n` are single points in the question space, not
 * regions of it — a free draw that happened to land on one would be a lesson
 * teaching a property by accident. Each is built directly and then put through
 * `satisfiesQuotient` with `excludeTrivial` off, so the arithmetic is checked by
 * the same judge as everything else even though the numbers were chosen.
 */
function constructedValue(
  mode: ShareMode,
  spec: QuotientSpec,
  ceiling: number,
): Quotient | undefined {
  if (mode === "identity") {
    const n = 2 + Math.floor(Math.random() * Math.max(1, Math.min(ceiling, 10) - 1));
    // Both shapes, every round: "one group of eight" and "eight groups of one"
    // are the same property seen from opposite ends, and a child who only meets
    // the first learns a rule about the digit 1 rather than about dividing.
    return Math.random() < 0.5
      ? { dividend: n, divisor: 1, quotient: n, remainder: 0, meaning: "share" }
      : { dividend: n, divisor: n, quotient: 1, remainder: 0, meaning: "share" };
  }
  if (mode === "zero_rules") {
    const divisor = 2 + Math.floor(Math.random() * 5);
    return { dividend: 0, divisor, quotient: 0, remainder: 0, meaning: "share" };
  }
  return undefined;
}

export function buildTrayQuestion(
  setup: ShareSetup,
  mode: ShareMode,
  index: number,
  seen?: Set<string>,
): ShareQuestion {
  const fallback = DEFAULTS[mode];
  const ceiling = setup.totalMax ?? fallback.totalMax;
  const spec: QuotientSpec = {
    divisorRange: setup.divisorRange ?? fallback.divisorRange,
    quotientRange: setup.quotientRange ?? fallback.quotientRange,
    dividendRange: [mode === "zero_rules" ? 0 : 2, ceiling],
    // Level 8 is the one that must leave something over, every single time.
    remainder: mode === "see_leftover" ? "always" : "never",
    meaning: setup.meaning ?? fallback.meaning,
    excludeTrivial: mode !== "identity" && mode !== "zero_rules",
  };

  /*
   * `n / 0` never reaches the generator.
   *
   * It is not a division with an awkward answer, it is not a division. The
   * judge refuses a divisor below one and this builds the question by hand,
   * which is the honest shape: the screen has to offer it, and nothing in the
   * number module has to pretend it is a quotient.
   */
  if (mode === "zero_rules" && index % 3 === 2) {
    const dividend = 2 + Math.floor(Math.random() * 10);
    const tone = pick(TONES);
    return {
      id: `division-zero_rules-${index}-${dividend}-0`,
      taskKind: "division_zero_rules",
      prompt: `Can you share ${dividend} between 0 plates?`,
      expected: "cannot",
      itemCount: dividend,
      mode,
      dividend,
      divisor: 0,
      quotient: 0,
      remainder: 0,
      meaning: "share",
      unknown: "size",
      answer: 0,
      tone,
      impossible: true,
    };
  }

  const draw = (): Quotient => {
    const made = constructedValue(mode, spec, ceiling);
    if (made) {
      if (!satisfiesQuotient(made, { ...spec, excludeTrivial: false })) {
        throw new Error(`divisionTray: constructed ${mode} question failed the judge`);
      }
      return made;
    }
    return drawQuotient(spec);
  };
  const value = seen ? withoutRepeat(draw, quotientKey, seen) : draw();
  const unknown = unknownFor(mode, value.meaning);
  const subject = pick(SUBJECTS);
  const tone = pick(TONES);
  const id = `division-${mode}-${index}-${value.dividend}-${value.divisor}`;

  const carriesStory = mode === "which_meaning" || mode === "to_equation";
  const story = carriesStory ? storyFor(subject, value, unknown) : undefined;

  /*
   * The answer is the quotient either way, and that is not a coincidence worth
   * hiding behind a branch. Sharing 12 between 3 plates puts 4 on a plate;
   * measuring 12 into plates of 3 makes 4 plates. Both are `12 ÷ 3`, and the
   * generator built both from the same 4. What differs is the *question*, which
   * is `unknown`, and the picture — never the number that comes back.
   */
  const answer = value.quotient;
  const base = {
    id,
    taskKind: `division_${mode}`,
    expected: mode === "which_meaning" ? unknown : String(answer),
    itemCount: value.dividend,
    mode,
    dividend: value.dividend,
    divisor: value.divisor,
    quotient: value.quotient,
    remainder: value.remainder,
    meaning: value.meaning,
    unknown,
    answer,
    tone,
    story,
  };

  const prompt = PROMPTS[mode](base as Omit<ShareQuestion, "prompt">);

  if (mode === "to_equation") {
    return {
      ...base,
      prompt,
      expected: `${value.dividend} ÷ ${value.divisor} = ${value.quotient}`,
      equations: orderBySeed(equationOptions(value), id),
    };
  }

  return { ...base, prompt };
}

/* -------------------------------------------------------------------------- */
/* Judging the tray                                                            */
/* -------------------------------------------------------------------------- */

/** Why the tray will not accept an answer yet. `null` means it will. */
export type TrayBlock =
  | "deal-them-all"
  | "not-equal"
  | "another-group-fits"
  | "plate-not-full"
  | "another-round-fits"
  | null;

/**
 * Whether the tray is in a state that can be answered, and why not if not.
 *
 * The refusals are the teaching. A child who answers "4" with three counters
 * still in the pile has not shared anything out, and accepting it would score a
 * technique they did not use. Each refusal names the rule it is protecting
 * rather than saying "try again".
 */
export function blockedBecause(
  question: ShareQuestion,
  plates: readonly number[],
  leftover = 0,
): TrayBlock {
  const dealt = plates.reduce((sum, n) => sum + n, 0);
  const pile = question.dividend - dealt - leftover;
  const shape = trayShapeFor(question);

  if (shape.plates !== undefined) {
    if (pile > 0) return "deal-them-all";
    const first = plates[0] ?? 0;
    if (plates.some((n) => n !== first)) return "not-equal";
    /*
     * The remainder rule, enforced with counters rather than stated.
     *
     * If what is in the bin would still go once round every plate, the child
     * has stopped early: the share is not finished. This is the same `r < d`
     * that level 23 will check in writing, three levels before the notation
     * exists — and here it is something they can see, because the counters to
     * do it with are sitting in the bin.
     */
    if (shape.leftoverBin && leftover >= question.divisor) return "another-round-fits";
    return null;
  }

  if (shape.capacity !== undefined) {
    if (pile >= shape.capacity) return "another-group-fits";
    if (plates.some((n) => n !== shape.capacity)) return "plate-not-full";
    if (pile > 0) return "deal-them-all";
    return null;
  }

  return null;
}

export const REFUSALS: Record<Exclude<TrayBlock, null>, string> = {
  "deal-them-all": "Deal them all out first.",
  "not-equal": "Every plate needs the same number.",
  "another-group-fits": "There are still enough left to make another group.",
  "plate-not-full": "Fill every group before you count them.",
  "another-round-fits": "There are still enough left to give one more to every plate.",
};
