import { khmerProblem, normalizeKhmer, spellingUnits, unitLabel } from "../library/data/khmer";
import type { PuzzleLang } from "./types";

/**
 * Word Guess: guess the word in six tries; each guess colours its tiles.
 *
 * A Khmer word is guessed in the tiles a Khmer class spells with — consonant,
 * each foot, vowel, sign — from the same `spellingUnits` the reading lessons
 * use, so ឆ្មា is ឆ + ្ម + ា. An English word is guessed letter by letter.
 */

export const MAX_GUESSES = 6;
export const MIN_TILES = 2;
export const MAX_TILES = 6;

export type TileState = "correct" | "present" | "absent";

/** The word as the tiles a child places, in order. */
export function tilesOf(word: string, lang: PuzzleLang): string[] {
  return lang === "km" ? spellingUnits(word) : [...word.trim().toLowerCase()];
}

/** How a tile is drawn: a Khmer mark sits on a dotted circle. */
export const tileLabel = (tile: string, lang: PuzzleLang): string => (lang === "km" ? unitLabel(tile) : tile.toUpperCase());

/** The word in the form it is stored and compared in. */
export const cleanWord = (word: string, lang: PuzzleLang): string =>
  lang === "km" ? normalizeKhmer(word.trim()) : word.trim().toLowerCase();

export type WordProblem = "empty" | "not_khmer" | "not_letters" | "spelling" | "too_short" | "too_long";

/** Why a word cannot be a puzzle, or null. The Studio says this before it is saved. */
export function wordProblem(word: string, lang: PuzzleLang): WordProblem | null {
  const w = cleanWord(word, lang);
  if (!w) return "empty";
  if (lang === "km") {
    if (![...w].every((ch) => (ch.codePointAt(0) ?? 0) >= 0x1780 && (ch.codePointAt(0) ?? 0) <= 0x17ff)) return "not_khmer";
    if (khmerProblem(w)) return "spelling";
  } else if (!/^[a-z]+$/.test(w)) return "not_letters";
  const n = tilesOf(w, lang).length;
  if (n < MIN_TILES) return "too_short";
  if (n > MAX_TILES) return "too_long";
  return null;
}

/**
 * How a guess scores against the answer, tile by tile.
 *
 * Exact matches first; then a tile in the wrong place is "present" only as
 * many times as the answer still has it, so guessing ា twice against a word
 * with one ា lights one tile, not two.
 */
export function scoreGuess(guess: readonly string[], answer: readonly string[]): TileState[] {
  const res: TileState[] = answer.map(() => "absent");
  const left = new Map<string, number>();
  answer.forEach((tile, i) => {
    if (guess[i] === tile) res[i] = "correct";
    else left.set(tile, (left.get(tile) ?? 0) + 1);
  });
  guess.forEach((tile, i) => {
    if (i >= answer.length || res[i] === "correct") return;
    const n = left.get(tile) ?? 0;
    if (n > 0) {
      res[i] = "present";
      left.set(tile, n - 1);
    }
  });
  return res;
}

const RANK: Record<TileState, number> = { absent: 1, present: 2, correct: 3 };

/** The best each tile has scored so far, for colouring the keyboard. */
export function keyStates(rows: ReadonlyArray<{ tiles: readonly string[]; result: readonly TileState[] }>): Map<string, TileState> {
  const out = new Map<string, TileState>();
  for (const row of rows) {
    row.tiles.forEach((tile, i) => {
      const s = row.result[i];
      const had = out.get(tile);
      if (s && (!had || RANK[s] > RANK[had])) out.set(tile, s);
    });
  }
  return out;
}

export const solved = (result: readonly TileState[]): boolean => result.length > 0 && result.every((s) => s === "correct");
