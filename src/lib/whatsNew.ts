/**
 * What's new — skills, books and Rebus puzzles an admin published lately.
 *
 * The server lists what went live in the last month (`GET /whats-new`). Home
 * shows a hero card for anything published in the last few days; it stays up
 * for those days, opened or not, unless the learner closes it. The list is
 * cached so the card still appears offline, and the fetch has a deadline so a
 * slow connection never holds Home.
 *
 * "Closed" is a convenience, not a record: it lives in localStorage, and losing
 * it only means a card shows again.
 */
import { useEffect, useState } from "react";
import { request } from "./sync/api";
import { accessToken } from "./sync/session";

export type NewItemKind = "skill" | "book" | "rebus";

export interface NewItem {
  kind: NewItemKind;
  id: string;
  title: string;
  /** Milliseconds since the epoch. */
  publishedAt: number;
  ages?: [number, number];
  language?: string;
  picture?: string;
  /** Rebus only: puzzles in the release. */
  count?: number;
}

/** How long a new thing stays on Home. */
export const SHOW_DAYS = 3;
const SHOW_MS = SHOW_DAYS * 24 * 60 * 60 * 1000;

const CACHE_KEY = "koda.whatsNew.items";
const CLOSED_PREFIX = "koda.whatsNew.closed.";
const DEADLINE_MS = 4_000;

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — this tab still works from memory */
  }
};

export const itemKey = (item: NewItem): string => `${item.kind}:${item.id}`;

export const cachedItems = (): NewItem[] => read<NewItem[]>(CACHE_KEY) ?? [];

export async function refreshWhatsNew(): Promise<NewItem[]> {
  const token = await accessToken();
  if (!token) return cachedItems();
  const body = await request<{ items: NewItem[] }>("/whats-new", { token, timeoutMs: DEADLINE_MS });
  write(CACHE_KEY, body.items);
  return body.items;
}

/** Items this learner closed. */
export const closedKeys = (who: string): Set<string> => new Set(read<string[]>(CLOSED_PREFIX + who) ?? []);

/** Close these items for this learner, forgetting closed items that have aged out. */
export function closeItems(who: string, closing: readonly NewItem[], current: readonly NewItem[]): void {
  const live = new Set(current.map(itemKey));
  const next = [...closedKeys(who), ...closing.map(itemKey)].filter((key) => live.has(key));
  write(CLOSED_PREFIX + who, [...new Set(next)]);
}

/** Whether an item is for a learner of this age. No ages means everyone. */
export const fitsAge = (item: NewItem, age: number): boolean =>
  !item.ages || (age >= item.ages[0] && age <= item.ages[1]);

/** Items still inside the show window and not closed, newest first. */
export function showing(items: readonly NewItem[], closed: ReadonlySet<string>, at: number = Date.now()): NewItem[] {
  return items
    .filter((item) => at - item.publishedAt < SHOW_MS && !closed.has(itemKey(item)))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/** The cached list at once, then the server's answer when it arrives. */
export function useWhatsNew(enabled: boolean): NewItem[] {
  const [items, setItems] = useState<NewItem[]>(() => (enabled ? cachedItems() : []));
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    refreshWhatsNew()
      .then((next) => live && setItems(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);
  return items;
}
