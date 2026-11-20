/**
 * The daily puzzles this device has, as the server last sent them.
 *
 * Kept so the game plays offline: the next 30 days on every line and every
 * live word. Asked for when the app starts and when the game opens; every
 * fetch has a deadline and fails quietly, because a poor connection must never
 * stop a child from playing — the device just plays from what it has, and with
 * nothing yet, from the starter words.
 */

import { accessToken, request } from "../lib/sync";
import { puzzleDay } from "./day";
import { fallbackPick } from "./fallback";
import { STARTER_PUZZLES, parsePuzzle } from "./starter";
import { slotKey, type DailyPuzzle, type PuzzleSlot } from "./types";

const KEY = "koda.puzzles.daily.v1";
const DEADLINE_MS = 6_000;
const MIN_GAP_MS = 60_000;

export interface DailySnapshot {
  /** slot key → the days the server has chosen. */
  lines: Record<string, Array<{ day: string; puzzleId: string }>>;
  puzzles: DailyPuzzle[];
  /** Whether this came from the server, or is the starter words only. */
  fromServer: boolean;
}

const listeners = new Set<() => void>();
let cached: DailySnapshot | null = null;
let lastAsked = 0;

function read(): DailySnapshot {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { lines?: DailySnapshot["lines"]; puzzles?: unknown[] };
      const puzzles = (parsed.puzzles ?? []).map(parsePuzzle).filter((p): p is DailyPuzzle => p !== null);
      if (puzzles.length) return (cached = { lines: parsed.lines ?? {}, puzzles, fromServer: true });
    }
  } catch {
    /* a broken copy is the same as none */
  }
  return (cached = { lines: {}, puzzles: STARTER_PUZZLES, fromServer: false });
}

export const dailySnapshot = (): DailySnapshot => read();

export const subscribeDaily = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Ask the server for the next days. Quiet on failure; resolves either way. */
export async function refreshDaily(force = false): Promise<void> {
  if (!force && Date.now() - lastAsked < MIN_GAP_MS) return;
  lastAsked = Date.now();
  try {
    const token = await accessToken();
    if (!token) return;
    const body = await request<{ lines: DailySnapshot["lines"]; puzzles: unknown[] }>("/daily-puzzles?days=30", { token, timeoutMs: DEADLINE_MS });
    const puzzles = (body.puzzles ?? []).map(parsePuzzle).filter((p): p is DailyPuzzle => p !== null);
    if (!puzzles.length) return;
    cached = { lines: body.lines ?? {}, puzzles, fromServer: true };
    try {
      localStorage.setItem(KEY, JSON.stringify({ lines: cached.lines, puzzles: body.puzzles }));
    } catch {
      /* still good for this visit */
    }
    listeners.forEach((fn) => fn());
  } catch {
    /* offline: keep what we have */
  }
}

/** The levels that have live words, per language: what the level picker offers. */
export function levelsFor(snap: DailySnapshot, lang: "km" | "en"): number[] {
  const set = new Set(snap.puzzles.filter((p) => p.lang === lang && p.status === "published").map((p) => p.level));
  return [...set].sort((a, b) => a - b);
}

/** Today's puzzle on a line: the server's choice if this device has it, else the same pick every device makes. */
export function todaysPuzzle(snap: DailySnapshot, slot: PuzzleSlot, day = puzzleDay()): DailyPuzzle | null {
  const chosen = snap.lines[slotKey(slot)]?.find((d) => d.day === day);
  const byId = chosen && snap.puzzles.find((p) => p.id === chosen.puzzleId);
  return byId || fallbackPick(snap.puzzles, slot, day);
}

/** A practice word: any live word on the line except the ones to avoid (today's, the last few played). */
export function practicePuzzle(snap: DailySnapshot, slot: PuzzleSlot, avoid: ReadonlySet<string>, random = Math.random): DailyPuzzle | null {
  const list = snap.puzzles.filter((p) => p.status === "published" && p.lang === slot.lang && p.level === slot.level && p.kind === slot.kind);
  const fresh = list.filter((p) => !avoid.has(p.id));
  const pool = fresh.length ? fresh : list;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

/** Tests only. */
export const resetDailyForTests = () => {
  cached = null;
  lastAsked = 0;
};
