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

/** The answers in Khmer, when the question has them and they line up with the English ones. */
const khmerOptions = (puzzle: Puzzle): string[] | null => {
  const words = puzzle.km?.options;
  return puzzle.choice && words && words.length === puzzle.choice.options.length ? words.map(toKhmerDigits) : null;
};

/** The English answer behind an option the child tapped on screen (the same text when the answers are not translated). */
export const optionAsAuthored = (puzzle: Puzzle, language: string, shown: string): string => {
  const words = language === "km" ? khmerOptions(puzzle) : null;
  const at = words ? words.indexOf(shown) : -1;
  return at >= 0 && puzzle.choice ? puzzle.choice.options[at] : shown;
};

/** An authored answer as it reads on screen: what a child sees for an answer the room or the game remembers. */
export const optionAsShown = (puzzle: Puzzle, language: string, authored: string): string => {
  const words = language === "km" ? khmerOptions(puzzle) : null;
  const at = words && puzzle.choice ? puzzle.choice.options.indexOf(authored) : -1;
  return words && at >= 0 ? words[at] : authored;
};

/** Whether a question has something to show in Khmer: its own words, or numbers to write in Khmer numerals. */
const hasKhmer = (puzzle: Puzzle): boolean => puzzle.kind === "math" || puzzle.kind === "quiz" || puzzle.km !== undefined;

export const localizePuzzle = (puzzle: Puzzle, language: string): Puzzle => {
  if (language !== "km" || !hasKhmer(puzzle)) return puzzle;
  const numeric = puzzle.kind === "math" || puzzle.kind === "quiz" || puzzle.kind === "choice";
  const words = khmerOptions(puzzle);
  if (words && puzzle.choice) {
    return {
      ...puzzle,
      pieces: (puzzle.km?.pieces ?? puzzle.pieces).map(inKhmer),
      explanation: toKhmerDigits(puzzle.km?.explanation ?? puzzle.explanation),
      answer: words[puzzle.choice.correct],
      choice: { ...puzzle.choice, options: words },
    };
  }
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
