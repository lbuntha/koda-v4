/**
 * The offline counting coach.
 *
 * A hint waits to be asked for. A five-year-old who has lost the thread of a
 * count does not ask — they tap the same rocket twice, or they stop tapping and
 * stare at the screen, and the round waits politely for an answer that is not
 * coming. This is the other half: Koda noticing on its own, and stepping in.
 *
 * Everything here is arithmetic on taps and a clock. No model, no request, no
 * key — which is not a limitation but the requirement: the children this is
 * written for are on unstable connections, and a coach that arrives four
 * seconds late has already lost the child it was coaching. The whole model is
 * three signals and a ladder.
 *
 * **The signals.** What "struggling" looks like when the only instrument is a
 * finger on glass:
 *
 *  - *stalled* — nothing touched for a while. Before the first tap this is not
 *    knowing where to start; mid-count it is having lost which number comes
 *    next.
 *  - *recount* — touching an object that already carries a number. One-to-one
 *    correspondence is the entire concept of this lesson, and this is what it
 *    looks like breaking. The round used to swallow the tap in silence.
 *  - *wandered* — jumping over an uncounted object to reach a later one. Not
 *    wrong, and not worth mentioning once; twice in a question is a child with
 *    no route through the row, which is how objects get missed.
 *
 * **The ladder.** Three rungs, same shape as the hint ladder — say it, show it,
 * walk it — because a cue strong enough for a child who is lost is patronising
 * to one who paused to think:
 *
 *  1. **Words.** What to do next, named. Nothing moves on screen.
 *  2. **Point.** The next object lights up while the words name the number it
 *     will be.
 *  3. **Walk.** The light follows the child from object to object for the rest
 *     of the question, and everything else on the scene steps back.
 *
 * A child climbs it within a question — each cue they needed makes the next one
 * stronger — and the round carries a little of it forward, so somebody who has
 * been coached through two questions does not start the third being told the
 * gentlest possible thing.
 */

/** Why Koda spoke up. */
export type GuideReason = "stalled" | "recount" | "wandered";

/** How hard the cue leans: say it, show it, walk it. */
export type GuideLevel = 1 | 2 | 3;

export interface GuideCue {
  reason: GuideReason;
  level: GuideLevel;
  /** On screen, in the lesson's own nouns. */
  text: string;
  /**
   * Out loud — the same instruction with the noun and the scene taken out.
   *
   * Two strings rather than one because the two have different costs. The
   * screen can afford "touch the next butterfly": drawing it is free. The voice
   * cannot — an unrecorded line goes to the server and then to the browser's
   * own synthesiser, and eight objects times six numbers is not a set anybody
   * is going to record. Kept to a handful of templates, it is recorded, it is
   * in the bundle, and it plays in the same tick as the tap that earned it.
   */
  say: string;
  /** Which object to light up, or -1 for a cue that is words only. */
  target: number;
}

/** What a lesson may tune. Wording is not on the list — see `cueFor`. */
export interface GuideSetup {
  /** Off unless a lesson asks for it. */
  enabled?: boolean;
  /** Stillness before the first tap that counts as stuck, in ms. */
  startMs?: number;
  /** Stillness mid-count, in ms. Shorter: the child is already going. */
  betweenMs?: number;
  /** How much each cue already given shortens the next wait, in ms. */
  hurryMs?: number;
  /** However impatient it gets, never quicker than this. */
  floorMs?: number;
}

export const GUIDE_DEFAULTS: Required<Omit<GuideSetup, "enabled">> = {
  /*
   * Seven seconds to start, five to carry on.
   *
   * Long enough that a child who is looking at the row and working it out is
   * left alone — thinking time is the lesson, and an adult who fills every
   * silence is teaching a child to wait for the adult. Short enough that the
   * silence does not become the end of the attempt.
   */
  startMs: 7000,
  betweenMs: 5000,
  hurryMs: 1500,
  floorMs: 2500,
};

/** The lesson's `guide` block, if it authored one. */
export function guideSetup(params: unknown): GuideSetup {
  const guide = (params as { guide?: unknown } | null | undefined)?.guide;
  return guide && typeof guide === "object" ? (guide as GuideSetup) : {};
}

const NUMBER_WORDS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/** A number as a child hears it. Digits past ten — nobody counts that far here. */
export const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/**
 * The object to point at: the next one along the route the child is taking.
 *
 * Left to right is what the lesson teaches and what an untouched row starts
 * with — but a child who has counted the last two from the right is *also*
 * counting in order, and sending them back to the far left would be correcting
 * a child who is doing it properly. So the direction of their last two taps
 * wins where it has somewhere to go, and the leftmost uncounted object is the
 * fallback: no direction yet, or a direction that has run out of row, which is
 * a child who has skipped something and needs sending back for it.
 */
export const nextTarget = (count: number, tapped: readonly number[]): number => {
  const left: number[] = [];
  for (let i = 0; i < count; i += 1) if (!tapped.includes(i)) left.push(i);
  if (left.length === 0) return -1;

  const last = tapped[tapped.length - 1];
  if (last === undefined) return left[0];

  const heading = tapped.length >= 2 ? Math.sign(last - tapped[tapped.length - 2]) : 0;
  if (heading !== 0) {
    const ahead = left.filter((i) => Math.sign(i - last) === heading);
    if (ahead.length > 0) return heading > 0 ? ahead[0] : ahead[ahead.length - 1];
  }
  return left[0];
};

/**
 * Did this tap hop, rather than step?
 *
 * Adjacency to the previous tap, in either direction — not "is anything to the
 * left of it still uncounted", which was the first version of this and which
 * calls a child counting steadily from the right a wanderer for the whole row.
 * What loses objects is not the direction, it is having no direction: one here
 * and one over there, with no way of knowing what has been visited.
 *
 * The first tap of a question can be anywhere. There is nothing yet to be out
 * of order with.
 */
export const isWander = (tapped: readonly number[], index: number): boolean => {
  const last = tapped[tapped.length - 1];
  if (last === undefined) return false;
  return Math.abs(index - last) !== 1;
};

/**
 * How long to wait before speaking up, given how this question has gone.
 *
 * Each cue already given shortens the next wait. A child who needed help once
 * is more likely to need it again, and making them sit out the full seven
 * seconds a second time is the coach being slow exactly where it should be
 * quick. The floor stops it turning into a running commentary.
 */
export const waitMs = (
  setup: GuideSetup,
  state: { tapped: number; shown: number },
): number => {
  const base = state.tapped === 0
    ? setup.startMs ?? GUIDE_DEFAULTS.startMs
    : setup.betweenMs ?? GUIDE_DEFAULTS.betweenMs;
  const hurry = (setup.hurryMs ?? GUIDE_DEFAULTS.hurryMs) * state.shown;
  return Math.max(setup.floorMs ?? GUIDE_DEFAULTS.floorMs, base - hurry);
};

/**
 * Which rung this cue comes in at.
 *
 * Only two things push it up, and neither of them is what went wrong. Cues
 * already given on this question — the child has heard the gentle version and
 * is still stuck, so the gentle version is not the one to say again. And a
 * round in which the coach has already been needed on two questions, because a
 * child that far into being coached is not served by starting at the bottom a
 * third time.
 *
 * What a recount changes is the *timing*, not the rung: it skips the clock,
 * because a child tapping a counted object is acting rather than hesitating. It
 * is tempting to have it skip a rung as well — one-to-one is the whole lesson
 * and it has just come apart — but the numbers are already sitting on the
 * objects, and the first thing to say to a child who has not read them is that
 * they are there. Lighting the next one up instead takes that reading away and
 * does it for them.
 */
export const levelFor = (state: { shown: number; coachedQuestions: number }): GuideLevel =>
  Math.min(3, (state.coachedQuestions >= 2 ? 2 : 1) + state.shown) as GuideLevel;

export interface CueInput {
  reason: GuideReason;
  level: GuideLevel;
  /** How many objects are in the row. */
  count: number;
  /** How many carry a number already. */
  tapped: number;
  /** The object to light up, from `nextTarget`. */
  target: number;
  /** What one of them is called: "rocket", "butterfly". */
  item: string;
}

/**
 * What Koda says, and what it lights up.
 *
 * Wording lives in code rather than in `lessons.json` for the same reason the
 * second hint rung does: every line here is read off what the child has
 * actually built — how many are tagged, which one is next, whether this is the
 * last — and a lesson cannot author a sentence about a row it has not seen.
 * What the lesson owns is whether the coach speaks at all, and how patient it is.
 *
 * Pure, and exported, so the copy can be tested against the row it describes. A
 * cue that says "touch the next one and say four" while three objects carry
 * numbers is worse than no cue at all, and that is not a fault a rendered test
 * would catch.
 */
export function cueFor(input: CueInput): GuideCue {
  const { reason, level, count, tapped, target, item } = input;
  /* The number the child will say when they touch it — which is how many are
     counted plus one, wherever in the row the object happens to sit. */
  const next = tapped + 1;
  const word = numberWord(next);
  const last = next === count;

  if (level === 1) {
    if (reason === "recount") {
      return {
        reason,
        level,
        text: `That ${item} already has a number on it. Touch one that is still plain.`,
        say: "That one already has a number. Touch one that is still plain.",
        target: -1,
      };
    }
    if (reason === "wandered") {
      return {
        reason,
        level,
        text: `Count them in order, left to right, so no ${item} gets missed.`,
        say: "Count them in order, from left to right.",
        target: -1,
      };
    }
    return tapped === 0
      ? {
          reason,
          level,
          text: `Start at the ${item} on the far left. Touch it and say "one".`,
          say: "Start at the very left. Touch it and say one.",
          target: -1,
        }
      : {
          reason,
          level,
          text: `You have counted ${tapped}. Touch the next ${item} and say "${word}".`,
          say: `Keep going. Touch the next one and say ${word}.`,
          target: -1,
        };
  }

  if (level === 2) {
    return {
      reason,
      level,
      text:
        reason === "recount"
          ? `The glowing ${item} has no number yet. Touch it and say "${word}".`
          : `This ${item} is next. Touch the glowing one and say "${word}".`,
      say: `Touch the glowing one and say ${word}.`,
      target,
    };
  }

  /*
   * The last rung may say the total.
   *
   * Nothing is being chosen here — the child answers by touching every object,
   * so the number at the end is the count they have just made rather than the
   * answer to a question they were meant to work out. Withholding it at the
   * point where the coach is walking them through object by object would be
   * withholding the one word the whole lesson is for.
   */
  return last
    ? {
        reason,
        level,
        text: `Last one! Touch the glowing ${item} and say "${word}" — that is how many there are.`,
        say: `Last one! Say ${word}. That is how many there are.`,
        target,
      }
    : {
        reason,
        level,
        text: `Touch the glowing ${item} and say "${word}". I will show you the next one.`,
        say: `Touch the glowing one and say ${word}.`,
        target,
      };
}
