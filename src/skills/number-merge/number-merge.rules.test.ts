import { describe, expect, it } from "vitest";
import { skill } from ".";
import {
  bestMove,
  merge,
  moves,
  newBoard,
  playable,
  resolve,
  seededRandom,
  settle,
  tilePool,
  verdict,
  type MergeSetup,
} from "./internal/rules";

/* Known answers, worked out by hand rather than read back from the rules. */
describe("what a merge does", () => {
  it("bonds pop only on the target", () => {
    const s = resolve({ mode: "bond", target: 10 });
    expect(verdict(s, 7, 3)).toEqual({ kind: "pop", value: 10 });
    expect(verdict(s, 7, 4)).toMatchObject({ kind: "refuse", reason: "notBond", value: 11 });
    expect(verdict(s, 5, 5).kind).toBe("pop");
  });

  it("differences pop when the numbers are the target apart, either way round", () => {
    const s = resolve({ mode: "difference", target: 3 });
    expect(verdict(s, 8, 5)).toEqual({ kind: "pop", value: 3 });
    expect(verdict(s, 5, 8)).toEqual({ kind: "pop", value: 3 });
    expect(verdict(s, 8, 6)).toMatchObject({ kind: "refuse", reason: "notDifference", value: 2 });
  });

  it("sums grow, pop on the target, and are refused over it", () => {
    const s = resolve({ mode: "sum", target: 12 });
    expect(verdict(s, 4, 5)).toEqual({ kind: "grow", value: 9 });
    expect(verdict(s, 9, 3)).toEqual({ kind: "pop", value: 12 });
    expect(verdict(s, 9, 4)).toMatchObject({ kind: "refuse", reason: "over" });
  });

  it("products grow only through factors of the target", () => {
    const s = resolve({ mode: "product", target: 24 });
    expect(verdict(s, 2, 3)).toEqual({ kind: "grow", value: 6 });
    expect(verdict(s, 6, 4)).toEqual({ kind: "pop", value: 24 });
    expect(verdict(s, 3, 3)).toMatchObject({ kind: "refuse", reason: "notFactor", value: 9 });
    expect(verdict(s, 6, 6)).toMatchObject({ kind: "refuse", reason: "over", value: 36 });
  });

  it("bundles ones into a ten and tens into a hundred, never mixing or going over", () => {
    const s = resolve({ mode: "bundle", target: 100 });
    expect(verdict(s, 4, 6)).toEqual({ kind: "grow", value: 10 });
    expect(verdict(s, 4, 7)).toMatchObject({ kind: "refuse", reason: "overTen" });
    expect(verdict(s, 30, 70)).toEqual({ kind: "pop", value: 100 });
    expect(verdict(s, 60, 50)).toMatchObject({ kind: "refuse", reason: "overHundred" });
    expect(verdict(s, 3, 10)).toMatchObject({ kind: "refuse", reason: "mixed" });
    expect(verdict(resolve({ mode: "bundle", target: 10 }), 4, 6)).toEqual({ kind: "pop", value: 10 });
  });

  it("fractions add in eighths and pop at one whole", () => {
    const s = resolve({ mode: "fraction", target: 8, parts: [1, 2, 4] });
    expect(verdict(s, 2, 2)).toEqual({ kind: "grow", value: 4 }); // 1/4 + 1/4 = 1/2
    expect(verdict(s, 4, 4)).toEqual({ kind: "pop", value: 8 }); // 1/2 + 1/2 = 1
    expect(verdict(s, 4, 6)).toMatchObject({ kind: "refuse", reason: "over" });
  });

  it("doubles facts pop on any equal pair; double-up grows by doubling to the target", () => {
    const facts = resolve({ mode: "doubleFact", max: 10 });
    expect(verdict(facts, 7, 7)).toEqual({ kind: "pop", value: 14 });
    expect(verdict(facts, 7, 6)).toMatchObject({ kind: "refuse", reason: "notSame" });
    const up = resolve({ mode: "double", target: 16, parts: [1, 2] });
    expect(verdict(up, 4, 4)).toEqual({ kind: "grow", value: 8 });
    expect(verdict(up, 8, 8)).toEqual({ kind: "pop", value: 16 });
    expect(verdict(up, 4, 2)).toMatchObject({ kind: "refuse", reason: "notSame" });
  });

  it("refuses a spec that cannot be played", () => {
    expect(() => resolve({ mode: "double", target: 12, parts: [1, 2] })).toThrow();
    expect(() => resolve({ mode: "bundle", target: 50 })).toThrow();
    expect(() => resolve({ mode: "bond", size: 9 })).toThrow();
  });
});

describe("boards", () => {
  const specs = skill.lessons.map((l) => {
    const p = l.params as { question: MergeSetup };
    return [l.id, p.question] as const;
  });

  it.each(specs)("%s: every new tile is legal, and every board has a move, merge after merge", (_id, q) => {
    const s = resolve(q);
    const pool = new Set(tilePool(s));
    expect(pool.size).toBeGreaterThan(0);
    for (let k = 0; k < 6; k += 1) {
      let board = newBoard(s, seededRandom(`${_id}:${k}`));
      for (let step = 0; step < 25; step += 1) {
        expect(board.cells.every(Boolean)).toBe(true);
        expect(playable(s, board)).toBe(true);
        const move = bestMove(s, board)!;
        const done = merge(s, board, move.from, move.to)!;
        board = settle(s, done.board, seededRandom(`${_id}:${k}:${step}`)).board;
      }
    }
  });

  it("plants a pair when random tiles leave nothing to do", () => {
    const s = resolve({ mode: "bond", target: 10, size: 3 });
    // A rand that only ever draws the first tile (1): nine 1s never make 10.
    const stuck = () => 0;
    const { board, reshuffled } = settle(s, { size: 3, cells: Array(9).fill(null), next: 1 }, stuck);
    expect(reshuffled).toBe(true);
    expect(moves(s, board).some((m) => m.verdict.kind === "pop")).toBe(true);
  });

  it("only merges neighbours", () => {
    const s = resolve({ mode: "bond", target: 10, size: 3 });
    const board = { size: 3, next: 10, cells: [7, 1, 3, 1, 1, 1, 1, 1, 1].map((v, i) => ({ id: i + 1, v })) };
    expect(merge(s, board, 0, 2)).toBeNull(); // 7 and 3 are two apart
    expect(merge(s, board, 0, 1)?.verdict.kind).toBe("refuse");
  });
});
