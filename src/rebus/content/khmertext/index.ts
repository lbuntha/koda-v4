import type { Puzzle } from "../../types";
import { COUNTRIES_KM } from "./countries";

/**
 * Khmer for the picture puzzles that are English wordplay: the "why" in Khmer, and the
 * Khmer words a child may type. Added one category at a time, and checked by a Khmer
 * reader in the Studio before it is published.
 */
export interface KhmerText {
  explanation: string;
  accepts?: string[];
}

/** Categories whose every puzzle has its Khmer text, so a new puzzle added there must come with one. */
export const CATEGORIES_WITH_KHMER_TEXT: readonly string[] = ["countries"];

const BY_ID: Record<string, KhmerText> = { ...COUNTRIES_KM };

/** A puzzle with its Khmer text added (one that already has its own Khmer is left as it is). */
export const withKhmerText = (puzzle: Puzzle): Puzzle => {
  const text = BY_ID[puzzle.id];
  if (!text || puzzle.km) return puzzle;
  return { ...puzzle, accepts: [...puzzle.accepts, ...(text.accepts ?? [])], km: { explanation: text.explanation } };
};

/** Ids with Khmer text here that no puzzle has: a typo to fix. */
export const khmerTextIds = (): string[] => Object.keys(BY_ID);
