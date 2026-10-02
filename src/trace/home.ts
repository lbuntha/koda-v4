/**
 * What the learner's Trace home shows, as plain data: each item once, the one
 * collection to put in the banner, and which row every other collection sits in.
 *
 * Kept out of the page so the choices can be tested without a screen — the page
 * only draws them.
 */

import type { ItemProgress } from "./progress/ladder";

export const isDone = (p: ItemProgress): boolean => p.status === "canDo" || p.status === "learned";

/**
 * One entry per item, the first one kept. Published entries come first, so an
 * author's draft of a published item, or an item in two collections, is shown
 * once and plays from its collection.
 */
export function uniqueById<T extends { item: { id: string } }>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => (seen.has(e.item.id) ? false : (seen.add(e.item.id), true)));
}

export interface ShelfCollection {
  id: string;
  itemIds: readonly string[];
}

export interface CollectionState {
  done: number;
  total: number;
  started: boolean;
  /** When an item of it was last practised; 0 if never. */
  lastAt: number;
}

export function stateOf(c: ShelfCollection, progress: (id: string) => ItemProgress): CollectionState {
  const ps = c.itemIds.map(progress);
  return {
    done: ps.filter(isDone).length,
    total: ps.length,
    started: ps.some((p) => p.step !== "watch" || isDone(p)),
    lastAt: Math.max(0, ...ps.map((p) => (p.step !== "watch" || isDone(p) ? p.updatedAt : 0))),
  };
}

export type RowId = "continue" | "new" | "finished";

export interface HomeRows<C> {
  /** The banner: the collection practised most recently and not finished, else the first not started, else the finished one practised last. */
  hero: C | null;
  rows: { id: RowId; collections: C[] }[];
}

/**
 * The rows, in the order a child needs them: what they are part-way through
 * (most recent first), what they have not tried, then what they have finished.
 * Empty rows are left out. The banner collection also stays in its row, so a
 * row never looks like it lost one.
 */
export function homeRows<C extends ShelfCollection>(collections: readonly C[], progress: (id: string) => ItemProgress): HomeRows<C> {
  const withState = collections.map((c) => ({ c, s: stateOf(c, progress) }));
  const finished = withState.filter(({ s }) => s.total > 0 && s.done === s.total);
  const going = withState.filter(({ s }) => s.started && s.done < s.total).sort((a, b) => b.s.lastAt - a.s.lastAt);
  const fresh = withState.filter(({ s }) => !s.started && s.done < s.total);
  // With everything finished, the one practised last, to go again — never an empty page.
  const again = [...finished].sort((a, b) => b.s.lastAt - a.s.lastAt);
  const hero = going[0]?.c ?? fresh[0]?.c ?? again[0]?.c ?? null;
  const rows = ([
    ["continue", going],
    ["new", fresh],
    ["finished", finished],
  ] as const)
    .filter(([, list]) => list.length > 0)
    .map(([id, list]) => ({ id, collections: list.map(({ c }) => c) }));
  return { hero, rows };
}
