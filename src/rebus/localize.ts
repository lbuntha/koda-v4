/**
 * A question in the language on screen.
 *
 * Only the words change. A question may carry its Khmer pieces and explanation
 * (`km`); the answer, the numbers and the pictures are shared, so there is one
 * question to approve, and a group room never gets the same sum twice in two
 * languages. In Khmer, digits are shown as Khmer numerals (១២៣); the answer
 * box takes either (see `normalizeAnswer`).
 */

import type { Piece, Puzzle } from "./types";

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

export const toKhmerDigits = (text: string): string => text.replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]);

const inKhmer = (piece: Piece): Piece => {
  if (piece.kind === "word") return { ...piece, text: toKhmerDigits(piece.text) };
  if (piece.kind === "stack") return { ...piece, top: toKhmerDigits(piece.top), bottom: toKhmerDigits(piece.bottom) };
  return piece;
};

/** Whether a question has something to show in Khmer: its own words, or numbers to write in Khmer numerals. */
const hasKhmer = (puzzle: Puzzle): boolean => puzzle.kind === "math" || puzzle.kind === "quiz" || puzzle.km !== undefined;

export const localizePuzzle = (puzzle: Puzzle, language: string): Puzzle => {
  if (language !== "km" || !hasKhmer(puzzle)) return puzzle;
  const numeric = puzzle.kind === "math" || puzzle.kind === "quiz" || puzzle.kind === "choice";
  return {
    ...puzzle,
    pieces: (puzzle.km?.pieces ?? puzzle.pieces).map(inKhmer),
    explanation: toKhmerDigits(puzzle.km?.explanation ?? puzzle.explanation),
    answer: numeric ? toKhmerDigits(puzzle.answer) : puzzle.answer,
    ...(puzzle.choice ? { choice: { ...puzzle.choice, options: puzzle.choice.options.map(toKhmerDigits) } } : {}),
  };
};

/** The keypad a typed answer wants: digits only for a whole number, a decimal pad for 2.5, the full keyboard for anything with a sign or a slash. */
export const answerInputMode = (puzzle: Pick<Puzzle, "kind" | "answer">): "numeric" | "decimal" | undefined => {
  if (puzzle.kind === "math") return "numeric";
  if (puzzle.kind !== "quiz") return undefined;
  if (/^\d+$/.test(puzzle.answer)) return "numeric";
  return /^\d+[.,]\d+$/.test(puzzle.answer) ? "decimal" : undefined;
};

/** Whether the answer is a number, so it is typed on a pad and not built from letter tiles. */
export const isNumberAnswer = (puzzle: Pick<Puzzle, "kind" | "answer">): boolean => puzzle.kind === "math" || (puzzle.kind === "quiz" && /^[-\d.,/\s]+$/.test(puzzle.answer));
