/**
 * The puzzles this device has, as the server last published them.
 *
 * The server's published list is the only source of puzzles: what an admin has
 * approved and published, nothing else. A device keeps the last list it was
 * given, so it plays offline; edits, additions and unpublished puzzles all
 * arrive here the next time it asks. The app asks when it starts, so the list
 * is on the device before a child opens Rebus Rush.
 *
 * Every fetch has a deadline and a quiet failure: a poor connection never
 * delays a round, it just means the list may be a little old.
 */

import { isAgeRange } from "../lib/ages";
import { accessToken, request } from "../lib/sync";
import { isCategoryId, parseCategories, setCategories, type Category } from "./categories";
import { prefetchPuzzlePhotos } from "./photos";
import { validatePuzzle } from "./puzzle";
import type { Piece, Puzzle } from "./types";

const KEY = "koda.rebus.bank.v1";
/** Do not ask again within this long of the last answer. */
const MIN_GAP_MS = 60_000;
const DEADLINE_MS = 6_000;

export interface BankSnapshot {
  version: number;
  puzzles: Puzzle[];
  /** The categories the owner has switched on, as the server last said. Missing on a copy saved by an older app. */
  categories?: Category[];
}

const PIECE_KINDS = new Set(["icon", "photo", "word", "stack", "op"]);

const isPiece = (p: unknown): p is Piece => typeof p === "object" && p !== null && PIECE_KINDS.has((p as { kind?: string }).kind ?? "");

/**
 * Whatever came over the wire or out of storage, as the puzzles that are safe to
 * play. A malformed row is dropped rather than shown broken.
 */
export const parsePuzzles = (raw: unknown): Puzzle[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is Puzzle => {
    if (typeof p !== "object" || p === null) return false;
    const x = p as Record<string, unknown>;
    if (typeof x.id !== "string" || typeof x.answer !== "string" || typeof x.explanation !== "string") return false;
    if (!isCategoryId(x.category) || !isAgeRange(x.ages) || ![1, 2, 3].includes(x.difficulty as number)) return false;
    if (!Array.isArray(x.pieces) || !x.pieces.every(isPiece) || !Array.isArray(x.accepts) || !x.accepts.every((a) => typeof a === "string")) return false;
    // No drawing check: one added through the Art library may not have reached this device yet, and a piece with no drawing shows its name.
    return validatePuzzle(p as Puzzle).length === 0;
  });
};

const load = (): BankSnapshot | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: unknown; puzzles?: unknown; categories?: unknown };
    const puzzles = parsePuzzles(parsed.puzzles);
    const categories = parseCategories(parsed.categories);
    return typeof parsed.version === "number" ? { version: parsed.version, puzzles, ...(categories.length > 0 ? { categories } : {}) } : null;
  } catch {
    return null;
  }
};

let snapshot: BankSnapshot | null = load();
if (snapshot?.categories) setCategories(snapshot.categories);
let lastAsked = 0;
const listeners = new Set<() => void>();

export const bankSnapshot = (): BankSnapshot | null => snapshot;

export const subscribeBank = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const adopt = (next: BankSnapshot): void => {
  snapshot = next;
  if (next.categories) setCategories(next.categories);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Not kept this time (storage full or off): the list is still used until the app closes. */
  }
  listeners.forEach((fn) => fn());
  // The photos in the list come along with it, so offline play never shows an empty frame.
  void prefetchPuzzlePhotos(next.puzzles);
};

/** Ask the server what is current. Quiet on any failure; the copy on this device stands. */
export const refreshBank = async (options: { force?: boolean } = {}): Promise<void> => {
  const nowMs = Date.now();
  if (!options.force && nowMs - lastAsked < MIN_GAP_MS) return;
  lastAsked = nowMs;
  try {
    const token = await accessToken();
    if (!token) return;
    const since = snapshot ? `?since=${snapshot.version}` : "";
    const body = await request<{ version: number; unchanged: boolean; puzzles: unknown; categories?: unknown }>(`/rebus/puzzles${since}`, { token, timeoutMs: DEADLINE_MS });
    if (body.unchanged) return;
    // An empty list is a real answer (nothing published, or everything unpublished): the server said so.
    if (Array.isArray(body.puzzles)) {
      const categories = parseCategories(body.categories);
      adopt({ version: body.version, puzzles: parsePuzzles(body.puzzles), ...(categories.length > 0 ? { categories } : {}) });
    }
  } catch {
    /* Offline or slow: nothing to say. */
  }
};

/** For tests: forget everything, as a fresh device. */
export const resetBank = (): void => {
  snapshot = null;
  lastAsked = 0;
  setCategories([]);
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to remove */
  }
  listeners.forEach((fn) => fn());
};
