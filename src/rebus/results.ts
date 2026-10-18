/**
 * How each puzzle went for this child, so a set can be filtered and replayed.
 *
 * One small record per puzzle: how many times it was played and how the last
 * play went. "clean" is a first-try win with no hint, "helped" a win that needed
 * a hint or a wrong guess, "missed" no win. Pure functions; storage is
 * `resultsStore.ts`.
 */

import type { PuzzleOutcome } from "./engine";

export type LastPlay = "clean" | "helped" | "missed";

export interface PuzzleRecord {
  plays: number;
  last: LastPlay;
}

export type Results = Readonly<Record<string, PuzzleRecord>>;

/** Which puzzles to offer: everything, ones never played, ones to try again, or ones got cleanly. */
export type StatusFilter = "all" | "new" | "retry" | "clean";

export const RESULTS_CAP = 3000;

export const lastPlayOf = (o: Pick<PuzzleOutcome, "winner" | "hintsUsed" | "wrong">): LastPlay =>
  o.winner !== "child" ? "missed" : o.hintsUsed === 0 && o.wrong === 0 ? "clean" : "helped";

export const recordPlay = (results: Results, id: string, last: LastPlay, cap: number = RESULTS_CAP): Results => {
  const { [id]: old, ...rest } = results;
  const next = { ...rest, [id]: { plays: (old?.plays ?? 0) + 1, last } };
  const ids = Object.keys(next);
  // Object keys keep insertion order, so the oldest-touched ids are first and go first.
  return ids.length > cap ? Object.fromEntries(ids.slice(ids.length - cap).map((k) => [k, next[k]])) : next;
};

export const matchesStatus = (record: PuzzleRecord | undefined, status: StatusFilter): boolean => {
  switch (status) {
    case "all":
      return true;
    case "new":
      return record === undefined;
    case "retry":
      return record !== undefined && record.last !== "clean";
    case "clean":
      return record?.last === "clean";
  }
};
