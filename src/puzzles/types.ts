/**
 * Daily puzzles: content an admin builds in the Puzzle Studio, played one a day.
 *
 * Code holds each kind's rules; the puzzles themselves — words, clues, which one
 * is on which day — are data from the server, so adding one never needs a
 * deploy. Word Guess is the first kind; Number Target is meant to be the next.
 */

export type PuzzleKind = "word-guess";
export type PuzzleLang = "km" | "en";

/**
 * Who made it.
 *
 * The Koda owner's puzzles, or a content creator's — a teacher given that role.
 * A creator writes drafts and sends them for review; only the owner publishes
 * to everyone and sets the calendar. Same split as Rebus Studio.
 */
export type PuzzleOwner = { scope: "koda" } | { scope: "creator"; userId: string };

/** draft → review (a creator asks) → published; retired keeps it out of new days but in old results. */
export type PuzzleStatus = "draft" | "review" | "published" | "retired";

/** The words the clue line draws from. Names live in i18n (`puzzles.category.*`). */
export const PUZZLE_CATEGORIES = ["animal", "food", "home", "nature", "body", "travel", "school", "family", "colour", "number", "time", "action"] as const;
export type PuzzleCategory = (typeof PUZZLE_CATEGORIES)[number];

export interface WordGuessData {
  /** As typed; Khmer is kept in its normal form. */
  word: string;
  category: PuzzleCategory;
  /** The hint: a meaning or a short clue, in each language. */
  clue: { km: string; en: string };
  /** A drawing from the picture library (`rebus-cat`), for children who cannot read the clue yet. */
  picture?: string;
}

export interface DailyPuzzle {
  id: string;
  kind: PuzzleKind;
  lang: PuzzleLang;
  /** For Word Guess, the number of tiles. Derived from the word, stored so lists can filter. */
  level: number;
  status: PuzzleStatus;
  owner: PuzzleOwner;
  data: WordGuessData;
}

/** One daily line: everyone playing the same kind, language and level gets the same puzzle each day. */
export interface PuzzleSlot {
  kind: PuzzleKind;
  lang: PuzzleLang;
  level: number;
}

export const slotKey = (s: PuzzleSlot): string => `${s.kind}:${s.lang}:${s.level}`;
