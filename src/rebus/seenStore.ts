/**
 * The seen log, kept on this device.
 *
 * Plain localStorage for now (Phase 4a moves it beside the category packs).
 * Every read and write is guarded: storage can be missing or full on a child's
 * tablet, and the game must simply carry on, repeating a puzzle at worst.
 */

import { recordSeen } from "./seen";

const KEY = "koda.rebus.seen";

export const loadSeen = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

/** Remember that these puzzles were played. */
export const markSeen = (ids: readonly string[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(recordSeen(loadSeen(), ids)));
  } catch {
    /* Not remembered this time; a puzzle may come round sooner than it should. */
  }
};
