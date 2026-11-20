import raw from "./content/word-guess.json";
import { PUZZLE_CATEGORIES, type DailyPuzzle, type PuzzleCategory } from "./types";
import { cleanWord, tilesOf, wordProblem } from "./wordGuess";

/**
 * The words Koda ships with.
 *
 * Two jobs: the server seeds them once (create-if-absent, so the Studio's edits
 * are never overwritten), and a device with no schedule yet plays from them.
 * The Studio is where words are added and changed; this file only starts it.
 */

const CATEGORIES = new Set<string>(PUZZLE_CATEGORIES);

/** A puzzle that came from storage or the wire, if it is safe to play; null otherwise. */
export function parsePuzzle(value: unknown): DailyPuzzle | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Partial<DailyPuzzle>;
  const d = p.data;
  if (typeof p.id !== "string" || p.kind !== "word-guess" || (p.lang !== "km" && p.lang !== "en")) return null;
  if (!d || typeof d.word !== "string" || !CATEGORIES.has(d.category as string)) return null;
  if (wordProblem(d.word, p.lang)) return null;
  const word = cleanWord(d.word, p.lang);
  const owner = p.owner?.scope === "creator" && typeof p.owner.userId === "string" ? p.owner : { scope: "koda" as const };
  const status = p.status === "draft" || p.status === "review" || p.status === "retired" ? p.status : "published";
  return {
    id: p.id,
    kind: "word-guess",
    lang: p.lang,
    level: tilesOf(word, p.lang).length,
    status,
    owner,
    data: {
      word,
      category: d.category as PuzzleCategory,
      clue: { km: typeof d.clue?.km === "string" ? d.clue.km : "", en: typeof d.clue?.en === "string" ? d.clue.en : "" },
    },
  };
}

export const STARTER_PUZZLES: DailyPuzzle[] = (raw as unknown[]).map(parsePuzzle).filter((p): p is DailyPuzzle => p !== null);
