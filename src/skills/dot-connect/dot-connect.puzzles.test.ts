import { describe, expect, it } from "vitest";
import { checkLines, isSolved } from "./internal/check";
import { exitsOf, hasDetour, hasEdgeRun, hasForcedStart, hasGap, shortestJoin, trapMoves } from "./internal/features";
import { answerIsValid, generateBoard, touchesItself } from "./internal/generate";
import { manhattan } from "./internal/grid";
import { solve } from "./internal/solve";
import { BOARD_SPECS, PRACTICE_SPECS, specFor } from "./internal/specs";
import type { Board } from "./internal/types";

const SEEDS = 8;

/**
 * Counts every way to fill the board by brute force: no pruning, no move
 * ordering, nothing shared with `solve`. Small boards only.
 */
function bruteCount(board: Pick<Board, "size" | "walls" | "pairs">): number {
  const { size, pairs } = board;
  const owner = new Array<number>(size * size).fill(-1);
  board.walls.forEach((w) => { owner[w] = -2; });
  pairs.forEach(([a, b], k) => { owner[a] = k; owner[b] = k; });
  const near = (c: number) => [c - size, c + size, c % size ? c - 1 : -1, (c + 1) % size ? c + 1 : -1]
    .filter((x) => x >= 0 && x < size * size);
  let count = 0;
  const grow = (k: number, head: number): void => {
    if (k === pairs.length) { if (owner.every((o) => o !== -1)) count += 1; return; }
    for (const nb of near(head)) {
      if (nb === pairs[k][1]) { grow(k + 1, k + 1 < pairs.length ? pairs[k + 1][0] : -1); continue; }
      if (owner[nb] !== -1) continue;
      owner[nb] = k; grow(k, nb); owner[nb] = -1;
    }
  };
  grow(0, pairs[0][0]);
  return count;
}

describe("dot-connect generator: every lesson spec", () => {
  for (const spec of BOARD_SPECS) {
    describe(spec.id, () => {
      const boards = Array.from({ length: SEEDS }, (_, s) => generateBoard(spec, s));

      it("deals the board the spec asks for", () => {
        for (const board of boards) {
          expect(board.size).toBe(spec.size);
          expect(board.pairs).toHaveLength(spec.pairs);
          expect(board.walls).toHaveLength(spec.walls ?? 0);
          expect(board.fallback).toBe(false);
        }
      });

      it("stores an answer the rules accept, covering every open square", () => {
        for (const board of boards) {
          expect(answerIsValid(board)).toBe(true);
          expect(isSolved(board, board.solution, true)).toBe(true);
          for (const line of board.solution) expect(line.length).toBeGreaterThanOrEqual(3);
        }
      });

      it("never puts a dot on a wall or two dots on one square", () => {
        for (const board of boards) {
          const dots = board.pairs.flat();
          expect(new Set(dots).size).toBe(dots.length);
          for (const w of board.walls) expect(dots).not.toContain(w);
        }
      });

      if (spec.mustFill) {
        it("has exactly one answer", () => {
          for (const board of boards) {
            const result = solve(board, 2);
            expect(result.capped).toBe(false);
            expect(result.count).toBe(1);
          }
        });

        it("stays inside its difficulty band", () => {
          const [low, high] = spec.difficulty ?? [0, Infinity];
          for (const board of boards) {
            expect(board.difficulty).toBeGreaterThanOrEqual(low);
            expect(board.difficulty).toBeLessThanOrEqual(high);
          }
        });
      }

      if (spec.feature) {
        it(`shows the lesson's feature (${spec.feature})`, () => {
          const check = { detour: hasDetour, gap: hasGap, "forced-start": hasForcedStart, edge: hasEdgeRun, trap: (b: Board) => trapMoves(b).length > 0 }[spec.feature!];
          for (const board of boards) expect(check(board)).toBe(true);
        });
      }

      it("is the same board for the same seed, and varies across seeds", () => {
        expect(generateBoard(spec, 3)).toEqual(boards[3]);
        const distinct = new Set(boards.map((b) => JSON.stringify(b.pairs) + b.walls.join()));
        // A 3×3 with one pair has only a handful of boards; it may repeat.
        expect(distinct.size).toBeGreaterThanOrEqual(spec.size <= 3 ? 4 : SEEDS - 1);
      });
    });
  }

  it("letters run in reading order, so A is the first dot from the top left", () => {
    for (const spec of BOARD_SPECS) {
      const board = generateBoard(spec, 0);
      const firsts = board.pairs.map((p) => Math.min(...p));
      expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    }
  });

  it("gets harder through the course: each unit's hardest band starts above the last", () => {
    const at = (id: string) => specFor(id)!.difficulty ?? [0, 0];
    expect(at("dont-box-it-in")[0]).toBeGreaterThan(at("fill-every-square")[0]);
    expect(at("five-pairs")[0]).toBeGreaterThan(at("hug-the-edge")[0]);
    expect(at("big-board")[0]).toBeGreaterThan(at("five-pairs")[0]);
    expect(at("on-your-own")[0]).toBeGreaterThanOrEqual(at("big-board")[0]);
  });

  it("fill-the-board lines never run beside themselves", () => {
    // Step-count boards keep them on purpose (they need a second answer without
    // the count), and a bridge line is two lines joined across another.
    for (const spec of BOARD_SPECS.filter((s) => s.mustFill && !s.steps && !s.bridge)) {
      for (const line of generateBoard(spec, 1).solution) expect(touchesItself(line, spec.size)).toBe(false);
    }
  });

  it("practice lessons only draw from specs that exist", () => {
    for (const ids of Object.values(PRACTICE_SPECS)) for (const id of ids) expect(specFor(id)).toBeDefined();
  });

  it("refuses an impossible spec instead of hanging", () => {
    expect(() => generateBoard({ id: "impossible", size: 3, pairs: 5, mustFill: true }, 0)).toThrow(/no board/);
  });
});

describe("dot-connect solver", () => {
  it("agrees with brute force on small boards, unique or not", () => {
    for (const spec of [specFor("two-pairs")!, specFor("go-around")!, specFor("fill-every-square")!]) {
      for (let s = 0; s < 6; s += 1) {
        const board = generateBoard(spec, s);
        expect(solve(board, 10_000).count).toBe(bruteCount(board));
      }
    }
  });

  it("finds no answer when the board is impossible", () => {
    // A and B both cross the middle of a 3×3: their lines must cross.
    const board = { size: 3, walls: [], pairs: [[1, 7], [3, 5]] as Array<[number, number]> };
    expect(bruteCount(board)).toBe(0);
    expect(solve(board).count).toBe(0);
  });

  it("returns a solution the independent check accepts", () => {
    const board = generateBoard(specFor("big-board")!, 2);
    const { solution } = solve(board);
    expect(isSolved(board, solution!, true)).toBe(true);
  });

  it("reports a capped search rather than claiming uniqueness", () => {
    const board = generateBoard(specFor("on-your-own")!, 0);
    const result = solve(board, 2, 3);
    expect(result.capped).toBe(true);
  });
});

describe("dot-connect win check", () => {
  // A B .      A: 0 → 6 down the left, B: 1 → 8 round the right.
  // A B B
  // A B B   (two valid answers exist for B; both must count)
  const board: Board = {
    size: 3, walls: [],
    pairs: [[0, 6], [1, 8]],
    solution: [[0, 3, 6], [1, 2, 5, 4, 7, 8]],
  };

  it("accepts the stored answer and a different valid one", () => {
    expect(isSolved(board, board.solution, true)).toBe(true);
    expect(isSolved(board, [[0, 3, 6], [1, 4, 7, 8]], false)).toBe(true);
  });

  it("joined but not filled only solves when filling is not required", () => {
    const lines = [[0, 3, 6], [1, 4, 7, 8]];
    expect(isSolved(board, lines, false)).toBe(true);
    expect(isSolved(board, lines, true)).toBe(false);
    expect(checkLines(board, lines).covered).toBe(7);
  });

  it("rejects jumps, overlaps, foreign dots and walls", () => {
    expect(checkLines(board, [[0, 6], []]).errors.join()).toMatch(/jumps/);
    expect(checkLines(board, [[0, 3, 6], [1, 4, 3]]).errors.join()).toMatch(/overlaps/);
    expect(checkLines(board, [[0, 1], []]).errors.join()).toMatch(/another colour's dot/);
    expect(checkLines({ ...board, walls: [4] }, [[], [1, 4]]).errors.join()).toMatch(/wall/);
  });

  it("an unfinished line is not joined", () => {
    expect(checkLines(board, [[0, 3], []]).joined).toEqual([]);
  });
});

describe("dot-connect lesson features read the board correctly", () => {
  it("detour: a dot sitting between a pair forces the line round", () => {
    // A at 0 and 2, B's dot at 1 in between.
    const blocked: Board = { size: 3, walls: [], pairs: [[0, 2], [1, 7]], solution: [] };
    expect(shortestJoin(blocked, 0)).toBe(4);
    expect(manhattan(0, 2, 3)).toBe(2);
    expect(hasDetour(blocked)).toBe(true);
    const clear: Board = { size: 3, walls: [], pairs: [[0, 2], [6, 8]], solution: [] };
    expect(hasDetour(clear)).toBe(false);
  });

  it("forced start: a corner dot boxed in by another dot has one exit", () => {
    const board: Board = { size: 3, walls: [], pairs: [[0, 8], [1, 2]], solution: [] };
    expect(exitsOf(board, 0)).toEqual([3]);
    expect(hasForcedStart(board)).toBe(true);
  });

  it("trap: every tempting first step it reports really leaves no answer", () => {
    const board = generateBoard(specFor("dont-box-it-in")!, 0);
    const traps = trapMoves(board);
    expect(traps.length).toBeGreaterThan(0);
    for (const { dot, step } of traps) {
      const k = board.pairs.findIndex((p) => p.includes(dot));
      const twin = board.pairs[k][0] === dot ? board.pairs[k][1] : board.pairs[k][0];
      expect(manhattan(step, twin, board.size)).toBeLessThan(manhattan(dot, twin, board.size));
      // Re-solved here with no node cap; the solver itself is held to brute force above.
      const pairs = board.pairs.map((p, j) => (j === k ? [dot, twin] : p)) as Array<[number, number]>;
      const prefix = pairs.map((p, j) => (j === k ? [dot, step] : [p[0]]));
      const result = solve({ size: board.size, walls: board.walls, pairs, prefix }, 1, Infinity);
      expect(result.count).toBe(0);
    }
  });
});
