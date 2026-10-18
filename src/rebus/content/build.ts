/**
 * Shorthand for writing puzzles as data.
 *
 * `fire` drawn as "hot": the icon id says which drawing, the spoken name says
 * what the child should read it as. Puzzles written with these helpers still
 * come out as plain `Puzzle` objects, so the Studio, a pack and the validator
 * never know the difference.
 */

import type { AgeRange } from "../../lib/ages";
import { ICON_PREFIX } from "../icons/library";
import type { CategoryId, Difficulty, Piece, Puzzle, Trick } from "../types";

/** A picture. `name` is what it is read as; it defaults to the drawing's own name. */
export const pic = (drawing: string, name: string = drawing, scale?: "big" | "small"): Piece => ({ kind: "icon", id: ICON_PREFIX + drawing, name, ...(scale ? { scale } : {}) });

export const word = (text: string, style?: "cut" | "small" | "big" | "upside-down"): Piece => ({ kind: "word", text, ...(style ? { style } : {}) });
export const stack = (top: string, bottom: string): Piece => ({ kind: "stack", top, bottom });

const PLUS: Piece = { kind: "op", op: "+" };
const AND: Piece = { kind: "op", op: "&" };

/** `a + b`: pieces joined by plus signs. */
export const sum = (...parts: Piece[]): Piece[] => parts.flatMap((p, i) => (i === 0 ? [p] : [PLUS, p]));
/** `a & b`: for pairs that go together ("salt and pepper"). */
export const and = (a: Piece, b: Piece): Piece[] => [a, AND, b];

/**
 * Who each difficulty is for. Wide on purpose: a nine-year-old can still enjoy
 * an easy one, and the oldest children must find enough that is not babyish.
 */
const AGES: Record<Difficulty, AgeRange> = { 1: [6, 12], 2: [8, 15], 3: [11, 18] };

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface PuzzleSpec {
  pieces: Piece[];
  answer: string;
  why: string;
  trick: Trick;
  difficulty?: Difficulty;
  accepts?: string[];
  ages?: AgeRange;
  /** The id's tail, for an answer that is not written in Latin letters (a Khmer word slugs to nothing). */
  key?: string;
}

/** A category's puzzles from short specs. Difficulty defaults to 1 (easy). */
export const puzzlesFor = (category: CategoryId, specs: readonly PuzzleSpec[]): Puzzle[] =>
  specs.map(({ pieces, answer, why, trick, difficulty = 1, accepts = [], ages, key }) => ({
    id: `${category}-${key ?? slug(answer)}`,
    category,
    ages: ages ?? AGES[difficulty],
    difficulty,
    trick,
    pieces,
    answer,
    accepts,
    explanation: why,
    source: "official",
  }));
