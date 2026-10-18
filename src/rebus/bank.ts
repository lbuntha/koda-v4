/**
 * Where the puzzles come from.
 *
 * Every screen asks for puzzles through `useRebusBank`. See `bankStore.ts` for where they come from.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { fitsAge } from "../lib/ages";
import { bankSnapshot, refreshBank, subscribeBank } from "./bankStore";
import type { CategoryId, Puzzle } from "./types";

export interface RebusBank {
  puzzles: readonly Puzzle[];
  /** How many puzzles each category has to play. */
  counts: Readonly<Record<CategoryId, number>>;
  /** True once this device has had the published list from the server, even an empty one. */
  loaded: boolean;
}

const countBy = (puzzles: readonly Puzzle[]): Record<CategoryId, number> => {
  const counts: Record<CategoryId, number> = { countries: 0, food: 0, sayings: 0, animals: 0, sports: 0, school: 0, science: 0, khmer: 0 };
  for (const p of puzzles) counts[p.category] += 1;
  return counts;
};

const makeBank = (puzzles: readonly Puzzle[], loaded: boolean): RebusBank => ({ puzzles, counts: countBy(puzzles), loaded });

/** Nothing until the server has been heard from once: children only ever play what has been published. */
const NOT_LOADED: RebusBank = makeBank([], false);

/**
 * The puzzles to play: the server's published list, kept on this device. There is
 * no built-in set, so what a child can play is exactly what an admin has approved
 * and published. The app fetches the list when it starts, so it is already here
 * (and works offline) by the time a child opens Rebus Rush; opening it asks again,
 * quietly, never in the way of a round.
 */
export const useRebusBank = (): RebusBank => {
  const snap = useSyncExternalStore(subscribeBank, bankSnapshot, bankSnapshot);
  useEffect(() => {
    void refreshBank();
  }, []);
  return useMemo(() => (snap ? makeBank(snap.puzzles, true) : NOT_LOADED), [snap]);
};

/** The bank as one child sees it: only the puzzles that suit their age, counted. */
export const bankForAge = (bank: RebusBank, age: number | null | undefined): RebusBank => makeBank(bank.puzzles.filter((p) => fitsAge(p.ages, age)), bank.loaded);
