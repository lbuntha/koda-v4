/**
 * Multiple-choice questions: the answers, and everything else worked out from them.
 *
 * An author writes a question (words, pictures, photos), gives two to four
 * answers and marks which one is right. The puzzle's `answer` is that option's
 * text, so what a child must pick and what the screen says can never disagree.
 * `server/app/rebus_choice.py` is the same rules in Python, tested against the
 * same cases.
 *
 * A child taps an answer, so nothing here is typed, and a wrong answer is
 * never close enough: choices are matched exactly (see `answer.ts`).
 */

import { makeRng, shuffled } from "./rng";

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const MAX_OPTION_CHARS = 40;

export interface ChoiceSpec {
  options: string[];
  /** The index in `options` of the right one. */
  correct: number;
}

export type ChoiceProblem = "choice-missing" | "choice-options" | "choice-blank" | "choice-duplicate" | "choice-correct";

/** An option as it is compared: case, spacing and punctuation do not make two options different. */
const keyOf = (text: string): string => text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");

export const isChoiceSpec = (value: unknown): value is ChoiceSpec => {
  if (typeof value !== "object" || value === null) return false;
  const x = value as Record<string, unknown>;
  return Array.isArray(x.options) && typeof x.correct === "number";
};

/** What is wrong with these answers, as a code, or null when the question is sound. */
export const choiceProblem = (spec: unknown): ChoiceProblem | null => {
  if (!isChoiceSpec(spec)) return "choice-missing";
  const { options, correct } = spec;
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return "choice-options";
  if (options.some((o) => typeof o !== "string" || keyOf(o) === "" || o.length > MAX_OPTION_CHARS)) return "choice-blank";
  if (new Set(options.map(keyOf)).size !== options.length) return "choice-duplicate";
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return "choice-correct";
  return null;
};

export const choiceAnswer = (spec: ChoiceSpec): string => spec.options[spec.correct].trim();

/** What a multiple-choice question's stored fields are, worked out from its answers. */
export const deriveChoice = (spec: ChoiceSpec): { choice: ChoiceSpec; answer: string; accepts: string[] } | null => {
  if (choiceProblem(spec) !== null) return null;
  const choice = { options: spec.options.map((o) => o.trim()), correct: spec.correct };
  return { choice, answer: choiceAnswer(choice), accepts: [] };
};

/**
 * The answers as a child sees them: in a shuffled order that is the same every time
 * for the same `seed` (so the right one is not always first), with wrong answers
 * taken away as hints are used. One wrong answer goes with the second hint and a
 * second with the third, but at least two answers always stay.
 */
export const visibleOptions = (spec: ChoiceSpec, hintsTaken: number, seed: string | number): string[] => {
  const order = shuffled(makeRng(`${seed}`), spec.options.map((text, index) => ({ text, index })));
  const wrong = order.filter((o) => o.index !== spec.correct);
  const remove = Math.min(Math.max(0, hintsTaken - 1), Math.max(0, spec.options.length - 2));
  const gone = new Set(wrong.slice(0, remove).map((o) => o.index));
  return order.filter((o) => !gone.has(o.index)).map((o) => o.text);
};
