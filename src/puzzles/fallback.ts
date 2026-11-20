import { hashSeed } from "../rebus/rng";
import { dayNumber } from "./day";
import { slotKey, type DailyPuzzle, type PuzzleSlot } from "./types";

/**
 * Today's puzzle when the device has no schedule from the server yet: a new
 * install with no signal. Every device makes the same pick from the same list,
 * so two offline friends still share a word.
 *
 * Walks the list with a step that shares no factor with its length, so a list
 * of n gives n different days before any repeats.
 */
export function fallbackPick(puzzles: readonly DailyPuzzle[], slot: PuzzleSlot, day: string): DailyPuzzle | null {
  const list = puzzles
    .filter((p) => p.status === "published" && p.kind === slot.kind && p.lang === slot.lang && p.level === slot.level)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!list.length) return null;
  const n = list.length;
  const step = [7, 11, 13, 17, 19, 23, 1].find((s) => gcd(s, n) === 1) ?? 1;
  const at = (((dayNumber(day) * step + hashSeed(slotKey(slot))) % n) + n) % n;
  return list[at];
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
