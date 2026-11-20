/**
 * A child's own Word Guess: the games they played, their streak, their word book.
 *
 * Per learner on this device. A daily game is saved after every guess, so a
 * child who closes the app halfway comes back to the same board, and cannot
 * play today's word twice.
 */

import { activeLearnerId } from "../lib/learning/learningLog";
import { addDays } from "./day";
import type { TileState } from "./wordGuess";

export interface GuessRow {
  tiles: string[];
  result: TileState[];
}

export interface GameRecord {
  puzzleId: string;
  rows: GuessRow[];
  over: boolean;
  won: boolean;
  hints: number;
  /** Seconds from the first guess to the end. */
  secs?: number;
  startedAt?: number;
}

export interface PlayStore {
  /** `${slot}|${day}` → today's game on that line. */
  daily: Record<string, GameRecord>;
  /** Days in a row with a solved daily word (any line). */
  streak: { last: string | null; n: number; best: number };
  /** Words solved, newest first: the child's word book. */
  words: Array<{ id: string; day: string }>;
  /** Practice words played lately, so practice does not repeat them. */
  recent: string[];
  /** Practice games that earned XP today: only the first PRACTICE_XP_GAMES a day do. */
  practiceXp: { day: string; n: number };
}

/** Practice is unlimited, its XP is not: the first 10 practice words a day earn it, so XP still means learning. */
export const PRACTICE_XP_GAMES = 10;

const KEEP_DAYS = 45;
const KEEP_WORDS = 500;

const keyFor = (learnerId: string) => `koda_word_guess_v1__${learnerId}`;
const empty = (): PlayStore => ({ daily: {}, streak: { last: null, n: 0, best: 0 }, words: [], recent: [], practiceXp: { day: "", n: 0 } });

export function readPlay(learnerId = activeLearnerId()): PlayStore {
  try {
    const raw = localStorage.getItem(keyFor(learnerId));
    if (!raw) return empty();
    const s = JSON.parse(raw) as Partial<PlayStore>;
    return {
      daily: s.daily && typeof s.daily === "object" ? s.daily : {},
      streak: { last: s.streak?.last ?? null, n: s.streak?.n ?? 0, best: s.streak?.best ?? 0 },
      words: Array.isArray(s.words) ? s.words : [],
      recent: Array.isArray(s.recent) ? s.recent : [],
      practiceXp: { day: typeof s.practiceXp?.day === "string" ? s.practiceXp.day : "", n: Number(s.practiceXp?.n) || 0 },
    };
  } catch {
    return empty();
  }
}

function write(store: PlayStore, learnerId: string) {
  try {
    localStorage.setItem(keyFor(learnerId), JSON.stringify(store));
  } catch {
    /* the game still plays; it just will not remember */
  }
}

export const dailyKey = (slot: string, day: string) => `${slot}|${day}`;

/** Save a daily game after a guess. At the end, a solve moves the streak and adds the word to the book. */
export function saveDaily(slot: string, day: string, game: GameRecord, learnerId = activeLearnerId()): PlayStore {
  const store = readPlay(learnerId);
  const before = store.daily[dailyKey(slot, day)];
  store.daily[dailyKey(slot, day)] = game;
  const oldest = addDays(day, -KEEP_DAYS);
  for (const k of Object.keys(store.daily)) if ((k.split("|")[1] ?? "") < oldest) delete store.daily[k];
  if (game.over && !before?.over && game.won) {
    store.streak = nextStreak(store.streak, day);
    store.words = [{ id: game.puzzleId, day }, ...store.words.filter((w) => w.id !== game.puzzleId)].slice(0, KEEP_WORDS);
  }
  write(store, learnerId);
  return store;
}

/** How many more practice words earn XP today. */
export function practiceXpLeft(day: string, learnerId = activeLearnerId()): number {
  const p = readPlay(learnerId).practiceXp;
  return Math.max(0, PRACTICE_XP_GAMES - (p.day === day ? p.n : 0));
}

/** A practice game ended: remember the word so practice moves on, book it if solved, and count it towards today's XP games. */
export function savePractice(game: GameRecord, day: string, learnerId = activeLearnerId()): PlayStore {
  const store = readPlay(learnerId);
  store.practiceXp = { day, n: (store.practiceXp.day === day ? store.practiceXp.n : 0) + 1 };
  store.recent = [game.puzzleId, ...store.recent.filter((id) => id !== game.puzzleId)].slice(0, 20);
  if (game.won && !store.words.some((w) => w.id === game.puzzleId)) store.words = [{ id: game.puzzleId, day }, ...store.words].slice(0, KEEP_WORDS);
  write(store, learnerId);
  return store;
}

/** Solving on consecutive days grows the run; a gap starts it again at 1. Solving twice in a day counts once. */
export function nextStreak(s: PlayStore["streak"], day: string): PlayStore["streak"] {
  if (s.last === day) return s;
  const n = s.last === addDays(day, -1) ? s.n + 1 : 1;
  return { last: day, n, best: Math.max(s.best, n) };
}

/** The run as of today: it is still alive if the last solve was today or yesterday. */
export function liveStreak(s: PlayStore["streak"], today: string): number {
  return s.last === today || s.last === addDays(today, -1) ? s.n : 0;
}
