/**
 * Is a puzzle fit to put in front of a child?
 *
 * The same checks run in three places: the maker's builder (live checklist),
 * the Studio's automatic stage before a person reviews a batch, and the server
 * before it will publish. One function, so they cannot drift.
 */

import { isAgeRange } from "../lib/ages";
import { compactAnswer } from "./answer";
import { isCategoryId } from "./categories";
import { choiceAnswer, choiceProblem, isChoiceSpec } from "./choice";
import { isMathSpec, mathAnswer, mathPrompt, mathProblem } from "./math";
import type { Piece, Puzzle } from "./types";

export const MAX_PIECES = 7;
/** A worked question may show a counted row of pictures, so it may have more pieces. */
export const MAX_QUIZ_PIECES = 12;
export const MIN_ANSWER_LETTERS = 3;
export const MIN_EXPLANATION_CHARS = 8;

export type PuzzleIssueCode =
  | "bad-category"
  | "bad-ages"
  | "bad-difficulty"
  | "no-picture"
  | "too-many-pieces"
  | "bad-operators"
  | "answer-short"
  | "answer-in-puzzle"
  | "no-explanation"
  | "unknown-icon"
  | "photo-no-name"
  | "unknown-photo"
  | "choice-missing"
  | "choice-options"
  | "choice-blank"
  | "choice-duplicate"
  | "choice-correct"
  | "choice-out-of-step"
  | "math-missing"
  | "bad-math-numbers"
  | "bad-math-op"
  | "bad-math-result"
  | "bad-math-missing"
  | "math-out-of-step";

export interface PuzzleIssue {
  code: PuzzleIssueCode;
  message: string;
}

/** What a piece says aloud: "germ", "MAN over BOARD". An operator says nothing. */
export const pieceName = (piece: Piece): string => {
  switch (piece.kind) {
    case "icon":
    case "photo":
      return piece.name;
    case "word":
      return piece.text;
    case "stack":
      return `${piece.top} over ${piece.bottom}`;
    case "op":
      return "";
  }
};

/** Pieces that carry meaning, in order, without the "+" between them. */
export const meaningfulPieces = (pieces: readonly Piece[]): Piece[] => pieces.filter((p) => p.kind !== "op");

/** Written text in the puzzle that could give the answer away. */
const writtenText = (piece: Piece): string[] => {
  if (piece.kind === "word") return [piece.text];
  if (piece.kind === "stack") return [piece.top, piece.bottom, piece.top + piece.bottom, piece.bottom + piece.top];
  return [];
};

const CHOICE_MESSAGES = {
  "choice-missing": "A multiple-choice question needs its answers.",
  "choice-options": "Give two to four answers.",
  "choice-blank": "Every answer needs some text (up to 40 characters).",
  "choice-duplicate": "Two answers say the same thing. Make each one different.",
  "choice-correct": "Mark which answer is the right one.",
  "choice-out-of-step": "The answer does not match the answer you marked as right. Save it again.",
} as const;

const MATH_MESSAGES = {
  "bad-math-numbers": "Use whole numbers from 0 to 9999.",
  "bad-math-op": "Pick +, −, × or ÷, and which part is missing.",
  "bad-math-result": "The sum must come out as a whole number from 0 to 9999 (division must be exact).",
  "bad-math-missing": "That sum has no single missing number. Use numbers other than 0.",
  "math-out-of-step": "The question and its answer do not match its numbers. Save it again.",
} as const;

export const validatePuzzle = (puzzle: Puzzle, options: { iconIds?: ReadonlySet<string>; categoryIds?: ReadonlySet<string> } = {}): PuzzleIssue[] => {
  const issues: PuzzleIssue[] = [];
  const add = (code: PuzzleIssueCode, message: string) => issues.push({ code, message });

  if (!isCategoryId(puzzle.category) || (options.categoryIds && !options.categoryIds.has(puzzle.category))) add("bad-category", "Pick one of the categories.");
  if (!isAgeRange(puzzle.ages)) add("bad-ages", "Ages must be a whole-year range between 4 and 18.");
  if (![1, 2, 3].includes(puzzle.difficulty)) add("bad-difficulty", "Difficulty is 1, 2 or 3.");

  const isMath = puzzle.kind === "math";
  if (isMath) {
    if (!isMathSpec(puzzle.math)) add("math-missing", "A math question needs its numbers.");
    else {
      const wrong = mathProblem(puzzle.math);
      if (wrong) add(wrong, MATH_MESSAGES[wrong]);
      else {
        const first = puzzle.pieces[0];
        const inStep = puzzle.pieces.length === 1 && first?.kind === "word" && first.text === mathPrompt(puzzle.math) && puzzle.answer === String(mathAnswer(puzzle.math)) && puzzle.accepts.length === 0;
        if (!inStep) add("math-out-of-step", MATH_MESSAGES["math-out-of-step"]);
      }
    }
  }

  const isChoice = puzzle.kind === "choice";
  if (isChoice) {
    const wrong = choiceProblem(puzzle.choice);
    if (wrong) add(wrong, CHOICE_MESSAGES[wrong]);
    else if (isChoiceSpec(puzzle.choice) && (puzzle.answer !== choiceAnswer(puzzle.choice) || puzzle.accepts.length > 0)) add("choice-out-of-step", CHOICE_MESSAGES["choice-out-of-step"]);
  }

  const isQuiz = puzzle.kind === "quiz";
  const meaningful = meaningfulPieces(puzzle.pieces);
  if (!isMath && meaningful.length === 0) add("no-picture", "Add at least one picture or word.");
  const maxPieces = isQuiz ? MAX_QUIZ_PIECES : MAX_PIECES;
  if (puzzle.pieces.length > maxPieces) add("too-many-pieces", `Use at most ${maxPieces} pieces.`);

  // An operator joins two things: it cannot start, end, or sit beside another.
  const ops = puzzle.pieces.map((p) => p.kind === "op");
  if (ops.some((isOp, i) => isOp && (i === 0 || i === ops.length - 1 || ops[i - 1] || ops[i + 1]))) {
    add("bad-operators", "A + or & must sit between two pieces.");
  }

  const answer = compactAnswer(puzzle.answer);
  if (!isMath && !isChoice && !isQuiz && [...answer].length < MIN_ANSWER_LETTERS) add("answer-short", `The answer needs at least ${MIN_ANSWER_LETTERS} letters.`);
  if (isQuiz && answer.length === 0) add("answer-short", "A question needs its answer.");

  const everyAnswer = [puzzle.answer, ...puzzle.accepts].map(compactAnswer).filter((a) => a.length > 0);
  const spelledOut = !isMath && !isChoice && !isQuiz && puzzle.pieces.some((p) => writtenText(p).some((t) => everyAnswer.includes(compactAnswer(t))));
  if (spelledOut) add("answer-in-puzzle", "The answer is written in the puzzle. Show it with pictures instead.");

  if (puzzle.explanation.trim().length < MIN_EXPLANATION_CHARS) add("no-explanation", "Say why the pieces give that answer.");

  if (options.iconIds) {
    const missing = puzzle.pieces.flatMap((p) => (p.kind === "icon" && !options.iconIds?.has(p.id) ? [p.name] : []));
    if (missing.length > 0) add("unknown-icon", `Not in the icon library: ${missing.join(", ")}.`);
  }

  if (puzzle.pieces.some((p) => p.kind === "photo" && p.name.trim() === "")) add("photo-no-name", "Say what each photo is read as.");

  return issues;
};

/** The key two puzzles share when they have the same answer, however it was typed. */
export const answerKey = (puzzle: Pick<Puzzle, "answer"> & Partial<Pick<Puzzle, "kind" | "math" | "pieces">>): string => {
  if (puzzle.kind === "math" && isMathSpec(puzzle.math) && mathProblem(puzzle.math) === null) return `math|${mathPrompt(puzzle.math)}`;
  // The same answer under a different question is a different puzzle ("Paris" answers many).
  if (puzzle.kind === "choice" || puzzle.kind === "quiz") return `choice|${compactAnswer(meaningfulPieces(puzzle.pieces ?? []).map(pieceName).join(""))}|${compactAnswer(puzzle.answer)}`;
  return compactAnswer(puzzle.answer);
};

/** Whether a puzzle's answer is already in a bank, for the Studio's duplicate stage. */
export const isDuplicate = (puzzle: Parameters<typeof answerKey>[0], existing: ReadonlySet<string>): boolean => existing.has(answerKey(puzzle));
