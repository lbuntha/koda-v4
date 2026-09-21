/**
 * What counting's coach knows that the kit cannot.
 *
 * `kit/round/useGuide.ts` owns *when* a child is coached and how hard; this is
 * the half only an activity can answer — where the next thing to touch is, and
 * which moves mean the technique has been dropped rather than that a finger
 * slipped.
 *
 * The wording is deliberately not here. It is the lesson's hint ladder, which
 * each activity already writes off live state and which the coach and the Hint
 * button now share: one set of words, however the help arrived.
 */

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
 * The next empty cell of a ten-frame, in reading order.
 *
 * Top row first, because that is the technique the lesson teaches: five on top
 * makes the five-benchmark visible, and a frame filled in order is one a child
 * can read "five and two more" off without counting it again.
 */
export const nextCell = (filled: readonly boolean[]): number => {
  for (let i = 0; i < filled.length; i += 1) if (!filled[i]) return i;
  return -1;
};

/**
 * Filling the bottom row while the top still has gaps.
 *
 * Not an error — the total comes out the same — but it is the one move that
 * throws away what the frame is *for*, so a child doing it has dropped the
 * technique rather than made a slip. Exactly the case worth a word.
 */
export const skippedTopRow = (filled: readonly boolean[], index: number): boolean => {
  if (index < 5) return false;
  for (let i = 0; i < 5; i += 1) if (!filled[i]) return true;
  return false;
};
