/**
 * The four numbers a child picks between, in an order they cannot learn.
 *
 * Every engine built the same ascending window — `answer - 2` through
 * `answer + 1` — which put the right answer third almost every time. Two or
 * three rounds of that is enough for a child to notice, and from then on the
 * third button is worth more than the arithmetic. Ten engines had their own
 * copy of the window, so the tell was identical everywhere and invisible in
 * any single file.
 *
 * The values are still near misses on purpose: an answer of 7 offered against
 * 5, 6 and 8 has to be worked out, where 7 against 40, 91 and 3 can be picked
 * off by size alone. Only the position moves.
 *
 * Seeded rather than random, because the order has to survive a re-render. A
 * fresh shuffle on every render would slide the buttons sideways each time a
 * hint opened or a nudge appeared — under a finger already on its way down,
 * which is worse than a predictable position. The same seed always gives the
 * same order, so a question is stable for as long as it is on screen and
 * different from the question after it.
 */

/** A small deterministic PRNG. Enough to shuffle four items reproducibly. */
const seededRandom = (seed: string): (() => number) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
};

export interface AnswerChoiceOptions {
  /** How many buttons to offer. Four unless an engine says otherwise. */
  count?: number;
  /** The gap between neighbouring options — 10 or 100 for estimates. */
  step?: number;
  /** Nothing below this is offered; a negative option is never an answer here. */
  min?: number;
  /** Nothing above this is offered, for an engine with a declared range. */
  max?: number;
}

/**
 * `count` distinct options including `answer`, ordered by `seed`.
 *
 * The window grows outward from the answer, so it stays centred where it can
 * and slides when the answer is near a bound — an answer of 0 still gets three
 * wrong neighbours rather than three clamped duplicates.
 */
export function answerChoices(
  answer: number,
  seed: string,
  { count = 4, step = 1, min = 0, max = Infinity }: AnswerChoiceOptions = {},
): number[] {
  const values = new Set<number>([answer]);
  for (let away = 1; values.size < count && away < count * 4; away += 1) {
    const below = answer - away * step;
    const above = answer + away * step;
    if (below >= min && below <= max) values.add(below);
    if (values.size < count && above >= min && above <= max) values.add(above);
  }

  const out = [...values];
  const random = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
