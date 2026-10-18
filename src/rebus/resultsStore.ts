/**
 * The per-puzzle results, kept on this device.
 *
 * Plain localStorage, every read and write guarded: storage can be missing or
 * full on a child's tablet, and the game simply carries on without a memory.
 */

import { lastPlayOf, recordPlay, type PuzzleRecord, type Results } from "./results";
import type { PuzzleOutcome } from "./engine";

const KEY = "koda.rebus.results.v1";

const isRecord = (v: unknown): v is PuzzleRecord => {
  const r = v as PuzzleRecord | null;
  return !!r && typeof r.plays === "number" && (r.last === "clean" || r.last === "helped" || r.last === "missed");
};

export const loadResults = (): Results => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isRecord(v)));
  } catch {
    return {};
  }
};

/** Remember how a puzzle just went. */
export const saveOutcome = (outcome: PuzzleOutcome): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(recordPlay(loadResults(), outcome.puzzle.id, lastPlayOf(outcome))));
  } catch {
    /* Not remembered this time. */
  }
};
