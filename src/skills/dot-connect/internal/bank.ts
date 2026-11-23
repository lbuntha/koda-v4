import bankJson from "./bank.json";
import { generateBoard } from "./generate";
import { specFor } from "./specs";
import type { Board, GeneratedBoard } from "./types";

/**
 * The boards a child can be dealt, built ahead of time.
 *
 * A 7×7 board with one answer takes a few hundred milliseconds to find on a
 * laptop and longer on a cheap phone, which is a visible freeze between
 * questions. So `scripts/build-dot-connect-bank.ts` generates them once, and
 * the round only looks one up. It also means every board a child can meet is
 * checked by the tests, not a sample of them.
 *
 * Each stored board is turned and mirrored into eight; the rules, the single
 * answer and every lesson feature survive both, so the checks still hold.
 */
export type BankEntry = Board & { difficulty: number };
export const BANK = bankJson as unknown as Record<string, BankEntry[]>;
export const SYMMETRIES = 8;

/** Rotate a quarter turn `t % 4` times, then mirror when `t >= 4`. */
export function transformCell(cell: number, size: number, t: number): number {
  let r = Math.floor(cell / size), c = cell % size;
  for (let i = 0; i < t % 4; i += 1) [r, c] = [c, size - 1 - r];
  if (t >= 4) c = size - 1 - c;
  return r * size + c;
}

/** The same board turned or mirrored, with its letters back in reading order. */
export function transformBoard<B extends Board>(board: B, t: number): B {
  const map = (cell: number) => transformCell(cell, board.size, t);
  const lines = board.solution.map((line, k) => ({ k, line: line.map(map) }))
    .map(({ k, line }) => ({ k, line: line[0] <= line[line.length - 1] ? line : line.slice().reverse() }))
    .sort((x, y) => x.line[0] - y.line[0]);
  const out: B = {
    ...board,
    walls: board.walls.map(map).sort((x, y) => x - y),
    solution: lines.map((l) => l.line),
    pairs: lines.map((l) => [l.line[0], l.line[l.line.length - 1]] as [number, number]),
  };
  if (board.bridges) out.bridges = board.bridges.map(map).sort((x, y) => x - y);
  if (board.steps) out.steps = { pair: lines.findIndex((l) => l.k === board.steps!.pair), steps: board.steps.steps };
  return out;
}

/** A starting place in the bank (0–999) from a seed: the same seed, the same place on every device. */
export function offsetForSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000;
}

/**
 * Board `index` (1-based) of a lesson, starting from `offset` into the bank.
 * A spec missing from the bank — a lesson authored after the last build — is
 * generated on the spot rather than refused.
 */
export function boardFor(specId: string, index: number, offset = 0): BankEntry {
  const stored = BANK[specId];
  if (!stored?.length) {
    const spec = specFor(specId);
    if (!spec) throw new Error(`dot-connect: unknown board spec "${specId}"`);
    const made: GeneratedBoard = generateBoard(spec, index + offset);
    return made;
  }
  const slot = (offset + index - 1) % (stored.length * SYMMETRIES);
  return transformBoard(stored[slot % stored.length], Math.floor(slot / stored.length));
}
