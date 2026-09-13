/**
 * Division in words, modelled on a bar before it is calculated.
 *
 * The arithmetic in these seven levels is easier than level 37's. The difficulty
 * is entirely in deciding *what to divide by what*, and a child who reaches for
 * the two numbers in the order they appear gets half of them right by luck. So
 * every question here is modelled first: the bar is set up, and only then is
 * there anything to answer.
 *
 * The one trap worth naming is level 53. "Alex has 24 and Sam has 6" supports
 * two different questions — *how many more* (18) and *how many times as many*
 * (4) — and children who have spent two years on comparison subtraction reach
 * for 18. The additive answer is offered every single time.
 */

import { pick, shuffle } from "./divisionNumbers";

export type StoryMode =
  /** Shared between a known number; how many each? */
  | "size_unknown"
  /** Put into groups of a known size; how many groups? */
  | "count_unknown"
  /** Something is left over, and the question decides what to do with it. */
  | "remainder_context"
  /** How much for one? */
  | "unit_rate"
  /** How many times as many? */
  | "times_comparison"
  /** One division and one other step. */
  | "multi_step"
  /** The fair share of a set — the mean. */
  | "mean";

export interface StorySetup {
  mode?: StoryMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  totalMax?: number;
}

export interface StoryQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: StoryMode;
  story: string;
  answer: number;
  /** Numbers offered, with the named traps among them. */
  choices: number[];
  /** How the bar is drawn: the whole, and how many parts it is cut into. */
  whole: number;
  parts: number;
  /** True when the child sets the number of parts before answering. */
  setsParts: boolean;
  /** The values being averaged, for the mean. */
  values?: number[];
}

const NAMES = ["Ana", "Ben", "Cleo", "Dev", "Esi", "Finn", "Gia", "Hal"] as const;
const THINGS = ["stickers", "marbles", "conkers", "beads", "cards", "shells"] as const;

const roll = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

/** Distinct, positive, and never including the answer twice. */
function options(answer: number, ...traps: number[]): number[] {
  const out: number[] = [answer];
  for (const trap of [...traps, answer + 1, answer * 2, Math.max(1, answer - 1)]) {
    if (trap > 0 && Number.isInteger(trap) && !out.includes(trap)) out.push(trap);
    if (out.length === 4) break;
  }
  return shuffle(out);
}

export function buildStoryQuestion(
  setup: StorySetup,
  mode: StoryMode,
  index: number,
): StoryQuestion {
  const who = pick(NAMES);
  const other = pick(NAMES.filter((n) => n !== who));
  const thing = pick(THINGS);
  const id = `division-${mode}-${index}`;

  const base = { mode, taskKind: `division_${mode}`, setsParts: false, itemCount: 1 };

  if (mode === "size_unknown") {
    const parts = roll(2, 12);
    const each = roll(2, 12);
    const whole = parts * each;
    return {
      ...base,
      id: `${id}-${whole}-${parts}`,
      story: `${who} has ${whole} ${thing} to share equally between ${parts} friends.`,
      prompt: "How many does each friend get?",
      expected: String(each),
      answer: each,
      choices: options(each, parts, whole - parts),
      whole,
      parts,
      setsParts: true,
    };
  }

  if (mode === "count_unknown") {
    const size = roll(2, 12);
    const groups = roll(2, 12);
    const whole = size * groups;
    return {
      ...base,
      id: `${id}-${whole}-${size}`,
      story: `${who} puts ${whole} ${thing} into bags of ${size}.`,
      prompt: "How many bags are there?",
      expected: String(groups),
      answer: groups,
      choices: options(groups, size, whole - size),
      whole,
      parts: groups,
      setsParts: true,
    };
  }

  if (mode === "remainder_context") {
    const size = roll(3, 8);
    const groups = roll(3, 9);
    const left = roll(1, size - 1);
    const whole = size * groups + left;
    const wantsMore = index % 2 === 0;
    const answer = wantsMore ? groups + 1 : groups;
    return {
      ...base,
      id: `${id}-${whole}-${size}`,
      story: `${whole} ${thing} are being put into boxes of ${size}.`,
      prompt: wantsMore
        ? "How many boxes are needed so that none are left out?"
        : "How many boxes can be filled completely?",
      expected: String(answer),
      answer,
      choices: options(answer, wantsMore ? groups : groups + 1, left),
      whole,
      parts: groups + (wantsMore ? 1 : 0),
    };
  }

  if (mode === "unit_rate") {
    const count = roll(2, 12);
    const each = roll(2, 20);
    const whole = count * each;
    return {
      ...base,
      id: `${id}-${whole}-${count}`,
      story: `${count} identical boxes of ${thing} hold ${whole} altogether.`,
      prompt: "How many are in one box?",
      expected: String(each),
      answer: each,
      choices: options(each, count, whole),
      whole,
      parts: count,
      setsParts: true,
    };
  }

  if (mode === "times_comparison") {
    const small = roll(2, 12);
    const times = roll(2, 9);
    const big = small * times;
    return {
      ...base,
      id: `${id}-${big}-${small}`,
      story: `${who} has ${big} ${thing}. ${other} has ${small}.`,
      prompt: `How many times as many does ${who} have?`,
      expected: String(times),
      answer: times,
      /*
       * The additive answer, every single time.
       *
       * "How many more" is the question these children have been answering
       * since they were six, and it is the one they will answer here unless
       * they are made to notice the difference.
       */
      choices: options(times, big - small, big + small),
      whole: big,
      parts: times,
    };
  }

  if (mode === "multi_step") {
    const parts = roll(2, 8);
    const each = roll(2, 12);
    const extra = roll(2, 15);
    const whole = parts * each + extra;
    return {
      ...base,
      id: `${id}-${whole}-${parts}`,
      story: `${who} has ${whole} ${thing}. After keeping ${extra}, the rest are shared equally between ${parts} friends.`,
      prompt: "How many does each friend get?",
      expected: String(each),
      answer: each,
      // Dividing before subtracting is the whole error, so it is offered.
      choices: options(each, Math.floor(whole / parts), extra),
      whole: whole - extra,
      parts,
      setsParts: true,
      itemCount: 2,
    };
  }

  // mean
  const count = roll(3, 6);
  const each = roll(3, 12);
  const values: number[] = [];
  let left = each * count;
  for (let i = 0; i < count - 1; i += 1) {
    const take = Math.max(1, Math.min(left - (count - 1 - i), roll(1, each * 2)));
    values.push(take);
    left -= take;
  }
  values.push(left);
  return {
    ...base,
    id: `${id}-${values.join("-")}`,
    story: `${who} counted ${thing} on ${count} days: ${values.join(", ")}.`,
    prompt: "If the days had all been the same, how many would that be each day?",
    expected: String(each),
    answer: each,
    choices: options(each, count, Math.max(...values)),
    whole: each * count,
    parts: count,
    values,
  };
}
