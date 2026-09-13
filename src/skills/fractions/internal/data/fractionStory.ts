/**
 * Fractions in words, modelled on a bar before anything is calculated.
 *
 * The arithmetic in these six levels is easier than level 36's. The difficulty
 * is deciding *which operation the words are asking for*, and a child who
 * reaches for the two numbers in the order they appear gets a good share of
 * them right by luck. So the bar is drawn first, every time.
 *
 * Two traps are named and offered on purpose:
 *
 *   Level 52 — "four cakes between three" has the answer `1 1/3`, and the
 *   remainder *becomes* the answer rather than being left over. A child who has
 *   done division with remainders will say "one each and one left over", which
 *   is true, and is not what was asked.
 *
 *   Level 55 — "how many times as much" is a division, and children who have
 *   spent two years on comparison subtraction reach for the difference. The
 *   subtractive answer is on the buttons every single time.
 */

import { pick, shuffle, simplify, valueOf, withoutRepeat, type Fraction, type Whole } from "./fractionNumbers";

export type StoryMode =
  /** A fraction of an amount, in words. */
  | "of_amount"
  /** Sharing where the leftover becomes a fraction. */
  | "share_leftover"
  /** Adding two fractions inside a situation. */
  | "add_context"
  /** Scaling a recipe: a mixed number times a whole one. */
  | "scale"
  /** How many times as much — a division, not a subtraction. */
  | "compare_context"
  /** One fraction step and one other. */
  | "multi_step";

export interface StorySetup {
  mode?: StoryMode;
  modes?: string[];
  practice?: boolean;
  questionsPerRound?: number;
  totalMax?: number;
}

const BAR: Whole = { kind: "bar", name: "the strip" };

const NAMES = ["Ana", "Ben", "Cleo", "Dev", "Esi", "Finn", "Gia", "Hal"] as const;
const THINGS = ["marbles", "stickers", "beads", "conkers", "shells", "cards"] as const;
const FOODS = ["cakes", "pizzas", "flapjacks", "loaves"] as const;
const DRINKS = ["juice", "milk", "water", "paint"] as const;

const roll = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

export const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;
export const mixedText = (ones: number, f: Fraction): string =>
  f.taken === 0 ? String(ones) : ones === 0 ? nameOf(f) : `${ones} ${nameOf(f)}`;

export interface StoryQuestion {
  id: string;
  taskKind: string;
  prompt: string;
  expected: string;
  itemCount: number;
  mode: StoryMode;
  /** The situation, in words. */
  story: string;
  /** How the bar is drawn: the whole amount, and how many parts it is cut into. */
  whole: number;
  parts: number;
  /** How many of those parts the answer takes, where the bar shows it. */
  shaded: number;
  /** What the bar is measured in, for the label under it. */
  unit: string;
  options: string[];
}

/** Four answers, the named trap among them, nothing written twice. */
function options(answer: string, ...traps: string[]): string[] {
  const out: string[] = [answer];
  const worth = (text: string): number => {
    const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
    if (!frac.includes("/")) return Number(ones) + Number(frac);
    const [top, bottom] = frac.split("/").map(Number);
    return Number(ones) + top / bottom;
  };
  /*
   * Generic fillers, for the questions where every trap collapses.
   *
   * "Half of 84" has the same number for one group, for the part left behind
   * and for the answer, so without these that question had two buttons.
   */
  const value = worth(answer);
  const fillers = Number.isInteger(value)
    ? [String(value * 2), String(value + 1), String(Math.max(1, value - 1)), String(value + 10)]
    : [];
  for (const trap of [...traps, ...fillers]) {
    if (!trap || /NaN|undefined|-/.test(trap)) continue;
    if (out.some((seen) => seen === trap || Math.abs(worth(seen) - worth(trap)) < 1e-9)) continue;
    out.push(trap);
    if (out.length === 4) break;
  }
  return shuffle(out);
}

export function buildStoryQuestion(
  setup: StorySetup,
  mode: StoryMode,
  index: number,
  seen?: Set<string>,
): StoryQuestion {
  const totalMax = setup.totalMax ?? 120;

  const draw = (): StoryQuestion => {
    const who = pick([...NAMES]);
    const other = pick(NAMES.filter((n) => n !== who));

    switch (mode) {
      case "of_amount": {
        const parts = roll(2, 6);
        const per = roll(2, Math.max(3, Math.floor(totalMax / parts)));
        const total = parts * per;
        const taken = roll(1, parts - 1);
        const thing = pick([...THINGS]);
        const answer = per * taken;
        return {
          id: `fractions-of_amount-${index}-${taken}-${parts}-${total}`,
          taskKind: "fractions_of_amount",
          prompt: "",
          story: `${who} has ${total} ${thing} and gives away ${taken}/${parts} of them. How many is that?`,
          expected: String(answer),
          itemCount: total,
          mode,
          whole: total,
          parts,
          shaded: taken,
          unit: thing,
          options: options(
            String(answer),
            // One group instead of the number of groups asked for.
            String(per),
            // What is left rather than what was given away.
            String(total - answer),
            String(total),
          ),
        };
      }

      case "share_leftover": {
        /*
         * The level where the remainder becomes the answer.
         *
         * Four cakes between three is `1 1/3` each, not "one each and one left
         * over" — the leftover cake is cut up, because cakes can be. The
         * remainder answer is offered every time, because it is the answer a
         * child brings with them from division.
         */
        /*
         * Never a share that comes out exactly.
         *
         * `8 cakes between 4` is two each with nothing left, which is the
         * division lesson from two years ago — this level is about what happens
         * to the one that is left over, so there has to be one.
         */
        const people = roll(2, 6);
        let cakes = roll(people + 1, people * 2 + 1);
        for (let i = 0; i < 30 && cakes % people === 0; i += 1) cakes = roll(people + 1, people * 2 + 1);
        const food = pick([...FOODS]);
        const ones = Math.floor(cakes / people);
        const rest = cakes % people;
        const share = { ones, fraction: simplify({ whole: BAR, parts: people, taken: rest }) };
        const answer = mixedText(share.ones, share.fraction);
        return {
          id: `fractions-share_leftover-${index}-${cakes}-${people}`,
          taskKind: "fractions_share_leftover",
          prompt: "",
          story: `${cakes} ${food} are shared equally between ${people} people. How much does each person get?`,
          expected: answer,
          itemCount: cakes,
          mode,
          whole: cakes,
          parts: people,
          shaded: 1,
          unit: food,
          options: options(
            answer,
            // The division answer: whole ones, with the rest left over.
            String(ones),
            // The leftover read as the answer.
            nameOf({ whole: BAR, parts: people, taken: rest }),
            mixedText(ones + 1, share.fraction),
          ),
        };
      }

      case "add_context": {
        const [p, q] = pick([
          [2, 3],
          [3, 4],
          [2, 5],
          [4, 5],
          [3, 6],
          [2, 8],
        ] as [number, number][]);
        const common = p * q;
        const left: Fraction = { whole: BAR, parts: p, taken: 1 };
        const right: Fraction = { whole: BAR, parts: q, taken: 1 };
        const sum = simplify({ whole: BAR, parts: common, taken: q + p });
        const drink = pick([...DRINKS]);
        return {
          id: `fractions-add_context-${index}-${p}-${q}`,
          taskKind: "fractions_add_context",
          prompt: "",
          story: `${who} drinks ${nameOf(left)} of a bottle of ${drink} and ${other} drinks ${nameOf(right)} of it. How much is gone?`,
          expected: nameOf(sum),
          itemCount: common,
          mode,
          whole: 1,
          parts: common,
          shaded: q + p,
          unit: `of a bottle`,
          options: options(
            nameOf(sum),
            // The bottoms added, which is the error the whole skill hunts.
            nameOf({ whole: BAR, parts: p + q, taken: 2 }),
            // What is left rather than what is gone.
            nameOf(simplify({ whole: BAR, parts: common, taken: common - q - p })),
            nameOf({ whole: BAR, parts: common, taken: q + p + 1 }),
          ),
        };
      }

      case "scale": {
        const parts = pick([2, 3, 4]);
        const taken = roll(1, parts - 1);
        const ones = roll(1, 2);
        const times = roll(2, 4);
        const totalParts = (ones * parts + taken) * times;
        const answer = {
          ones: Math.floor(totalParts / parts),
          fraction:
            totalParts % parts === 0
              ? { whole: BAR, parts, taken: 0 }
              : simplify({ whole: BAR, parts, taken: totalParts % parts }),
        };
        const written = mixedText(answer.ones, answer.fraction);
        const thing = pick(["flour", "sugar", "oats", "rice"]);
        return {
          id: `fractions-scale-${index}-${ones}-${taken}-${parts}-x${times}`,
          taskKind: "fractions_scale",
          prompt: "",
          story: `A recipe needs ${mixedText(ones, { whole: BAR, parts, taken })} cups of ${thing}. ${who} is making ${times} times as much. How many cups?`,
          expected: written,
          itemCount: totalParts,
          mode,
          whole: times,
          parts,
          shaded: taken,
          unit: "cups",
          options: options(
            written,
            // The whole ones multiplied and the fraction left behind.
            mixedText(ones * times, { whole: BAR, parts, taken }),
            // The fraction multiplied and the whole ones left behind.
            mixedText(ones, { whole: BAR, parts, taken: Math.min(parts - 1, taken * times) }),
            mixedText(answer.ones + 1, answer.fraction),
          ),
        };
      }

      case "compare_context": {
        /*
         * "How many times as much" is a division, and the difference is the
         * answer a child gives who has spent two years on comparison
         * subtraction. It is on the buttons every single time.
         */
        /*
         * Built so the bigger share always fits, rather than redrawn when it
         * does not.
         *
         * The first version handed the question off to level 51 whenever the
         * numbers missed, so a child doing "how many times as much" was
         * sometimes given "a fraction of an amount" instead — a different
         * level, with a different lesson, inside this one's round.
         */
        const parts = pick([4, 5, 6, 8, 9, 10, 12]);
        const times = roll(2, Math.min(4, parts - 1));
        const small = roll(1, Math.max(1, Math.floor((parts - 1) / times)));
        const big = small * times;
        const thing = pick([...THINGS]);
        const difference = simplify({ whole: BAR, parts, taken: big - small });
        return {
          id: `fractions-compare_context-${index}-${small}-${big}-${parts}`,
          taskKind: "fractions_compare_context",
          prompt: "",
          story: `${who} fills ${nameOf({ whole: BAR, parts, taken: big })} of a box with ${thing} and ${other} fills ${nameOf({ whole: BAR, parts, taken: small })} of an identical box. How many times as much does ${who} have?`,
          expected: String(times),
          itemCount: parts,
          mode,
          whole: 1,
          parts,
          shaded: big,
          unit: "of a box",
          options: options(
            String(times),
            // The difference — the subtractive answer to a division question.
            nameOf(difference),
            String(big),
            String(times + 1),
          ),
        };
      }

      default: {
        /*
         * Two steps, and the first one is the fraction.
         *
         * A single-step question can be answered by grabbing both numbers and
         * guessing an operation. This one cannot: the answer to the first step
         * is not on the buttons.
         */
        const parts = roll(2, 5);
        const per = roll(3, 12);
        const total = parts * per;
        const taken = roll(1, parts - 1);
        const given = per * taken;
        const extra = roll(2, 9);
        const thing = pick([...THINGS]);
        const answer = total - given + extra;
        return {
          id: `fractions-multi_step-${index}-${total}-${taken}-${parts}-${extra}`,
          taskKind: "fractions_multi_step",
          prompt: "",
          story: `${who} has ${total} ${thing} and gives ${taken}/${parts} of them to ${other}. Then ${who} finds ${extra} more. How many now?`,
          expected: String(answer),
          itemCount: total,
          mode,
          whole: total,
          parts,
          shaded: taken,
          unit: thing,
          options: options(
            String(answer),
            // Stopped after the first step.
            String(total - given),
            // Added the extra to the part given away.
            String(given + extra),
            String(total + extra),
          ),
        };
      }
    }
  };

  const built = seen ? withoutRepeat(draw, (q) => q.story, seen) : draw();
  return { ...built, prompt: built.story };
}

/** What an answer is worth, so two spellings of one amount can be spotted. */
const amountOf = (text: string): number => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return Number(ones) + Number(frac);
  const [top, bottom] = frac.split("/").map(Number);
  return Number(ones) + top / bottom;
};

/** Whether an answer is right, which is a question about the amount. */
export function isStoryCorrect(q: StoryQuestion, given: string): boolean {
  if (given === q.expected) return true;
  const a = amountOf(given);
  const b = amountOf(q.expected);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
}

/* -------------------------------------------------------------------------- */
/* What the child is told afterwards                                          */
/* -------------------------------------------------------------------------- */

export function explainStory(q: StoryQuestion, correct: boolean): string {
  if (!correct) {
    switch (q.mode) {
      case "of_amount":
        return "Cut the whole amount into the groups the bottom number asks for, then take that many groups.";
      case "share_leftover":
        return "The one left over does not stay left over. It gets cut up and shared as well.";
      case "add_context":
        return "Both pieces have to be the same size before they can be counted together.";
      case "scale":
        return "The whole ones and the fraction both get multiplied. Neither one stays behind.";
      case "compare_context":
        return "How many times as much is a division. Taking one away from the other answers a different question.";
      default:
        return "There are two steps here. Work out the first one, then do the second to that answer.";
    }
  }

  switch (q.mode) {
    case "of_amount":
      return `Cut the ${q.whole} into ${q.parts} equal groups and take ${q.shaded} of them — that is ${q.expected}.`;
    case "share_leftover":
      return `Everybody gets a whole one first, and what is left is cut between them — ${q.expected} each.`;
    case "add_context":
      return `Cut both into the same-sized pieces and count them together: ${q.expected} of the bottle.`;
    case "scale":
      return `Multiply the whole cups and the part cups, then gather the parts into whole ones — ${q.expected}.`;
    case "compare_context":
      return `Ask how many of the smaller fill the larger, and the answer is ${q.expected} times as much.`;
    default:
      return `Give some away first, then add what turned up afterwards — ${q.expected} at the end.`;
  }
}

export { simplify, valueOf };
