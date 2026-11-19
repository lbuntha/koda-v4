import { describe, expect, it } from "vitest";
import { BANK, SYMMETRIES, boardFor, transformBoard, transformCell } from "./internal/bank";
import { checkLines, isSolved } from "./internal/check";
import { hasDetour, hasEdgeRun, hasForcedStart, hasGap, trapMoves } from "./internal/features";
import { generateBoard } from "./internal/generate";
import { solve } from "./internal/solve";
import { BOARD_SPECS, PRACTICE_SPECS, specFor } from "./internal/specs";
import type { Board, Feature } from "./internal/types";
import lessons from "./lessons.json";

/**
 * Every board a child can be dealt, checked — not a sample.
 *
 * The round only ever reads boards from the bank (turned or mirrored), so
 * checking each stored board, plus that turning and mirroring keep every
 * property, covers everything that can appear on screen.
 */

const FEATURES: Record<Feature, (b: Board) => boolean> = {
  detour: hasDetour, gap: hasGap, "forced-start": hasForcedStart, edge: hasEdgeRun, trap: (b) => trapMoves(b).length > 0,
};

describe("dot-connect board bank", () => {
  it("holds boards for every spec, and nothing else", () => {
    expect(Object.keys(BANK).sort()).toEqual(BOARD_SPECS.map((s) => s.id).sort());
    for (const boards of Object.values(BANK)) expect(boards.length).toBeGreaterThanOrEqual(12);
  });

  it("matches the generator, so a generator change without a rebuild fails", () => {
    for (const spec of BOARD_SPECS) {
      const { specId: _s, fallback: _f, ...fresh } = generateBoard(spec, 0);
      expect(BANK[spec.id][0], `${spec.id}: run npx tsx scripts/generate-dot-connect-bank.ts`).toEqual(fresh);
    }
  });

  for (const spec of BOARD_SPECS) {
    describe(spec.id, () => {
      const boards = BANK[spec.id];

      it("every board has the spec's size, pairs, walls, bridge and step count", () => {
        for (const b of boards) {
          expect(b.size).toBe(spec.size);
          expect(b.pairs).toHaveLength(spec.pairs);
          expect(b.walls).toHaveLength(spec.walls ?? 0);
          expect(b.bridges?.length ?? 0).toBe(spec.bridge ? 1 : 0);
          expect(!!b.steps).toBe(!!spec.steps);
        }
      });

      it("every stored answer obeys the rules and fills the board", () => {
        for (const b of boards) {
          const check = checkLines(b, b.solution);
          expect(check.errors).toEqual([]);
          expect(check.covered).toBe(check.open);
          expect(isSolved(b, b.solution, true)).toBe(true);
        }
      });

      if (spec.mustFill) {
        it("every board has exactly one answer", () => {
          for (const b of boards) {
            const result = solve(b, 2, 2_000_000);
            expect(result.capped).toBe(false);
            expect(result.count).toBe(1);
          }
        });

        it("every board sits inside the lesson's difficulty band", () => {
          const [low, high] = spec.difficulty ?? [0, Infinity];
          for (const b of boards) {
            expect(b.difficulty).toBeGreaterThanOrEqual(low);
            expect(b.difficulty).toBeLessThanOrEqual(high);
          }
        });
      }

      if (spec.feature) {
        it(`every board shows the lesson's feature (${spec.feature})`, () => {
          for (const b of boards) expect(FEATURES[spec.feature!](b)).toBe(true);
        });
      }

      if (spec.steps) {
        it("the step count is what makes the answer unique", () => {
          for (const b of boards) {
            const { steps, ...free } = b;
            expect(steps!.steps).toBe(b.solution[steps!.pair].length - 1);
            expect(solve(free, 2, 2_000_000).count).toBe(2);
          }
        });
      }

      if (spec.bridge) {
        it("the answer crosses the bridge both ways", () => {
          for (const b of boards) {
            const bridge = b.bridges![0];
            const ways = b.solution.flatMap((line) => line.flatMap((cell, i) => (cell === bridge ? [Math.abs(cell - line[i - 1])] : [])));
            expect(ways.sort()).toEqual([1, b.size]);
          }
        });
      }
    });
  }

  it("lessons and practice only name specs the bank holds", () => {
    for (const lesson of lessons.lessons) {
      const q = lesson.params.question as { spec?: string; specs?: string[] };
      for (const id of q.specs ?? [q.spec!]) expect(BANK[id], `${lesson.id} -> ${id}`).toBeDefined();
    }
    for (const ids of Object.values(PRACTICE_SPECS)) for (const id of ids) expect(BANK[id]).toBeDefined();
  });
});

describe("turning and mirroring a board", () => {
  it("is a permutation of the squares for each of the eight ways", () => {
    for (let t = 0; t < SYMMETRIES; t += 1) {
      const seen = new Set(Array.from({ length: 25 }, (_, c) => transformCell(c, 5, t)));
      expect(seen.size).toBe(25);
    }
    // The eight ways are all different.
    const corners = Array.from({ length: SYMMETRIES }, (_, t) => [transformCell(0, 5, t), transformCell(1, 5, t)].join());
    expect(new Set(corners).size).toBe(SYMMETRIES);
  });

  it("keeps one answer, the band, the feature, the bridge and the step count", () => {
    for (const spec of BOARD_SPECS) {
      const stored = BANK[spec.id][0];
      for (let t = 1; t < SYMMETRIES; t += 1) {
        const b = transformBoard(stored, t);
        expect(isSolved(b, b.solution, true), `${spec.id} t=${t}`).toBe(true);
        if (spec.mustFill) {
          const result = solve(b, 2, 2_000_000);
          expect(result.count, `${spec.id} t=${t}`).toBe(1);
        }
        if (spec.feature) expect(FEATURES[spec.feature](b), `${spec.id} t=${t}`).toBe(true);
        if (spec.steps) expect(b.solution[b.steps!.pair].length - 1).toBe(b.steps!.steps);
        // Letters stay in reading order.
        const firsts = b.pairs.map((p) => p[0]);
        expect(firsts).toEqual([...firsts].sort((x, y) => x - y));
      }
    }
  });

  it("boardFor deals every stored board in every turn before it repeats", () => {
    const id = "fill-every-square";
    const n = BANK[id].length * SYMMETRIES;
    const dealt = new Set(Array.from({ length: n }, (_, i) => JSON.stringify(boardFor(id, i + 1).pairs)));
    // Small boards can look the same after a turn, so not all n are distinct.
    expect(dealt.size).toBeGreaterThan(n * 0.6);
    expect(boardFor(id, n + 1)).toEqual(boardFor(id, 1));
  });

  it("boardFor refuses a spec that does not exist", () => {
    const spare = { ...specFor("two-pairs")!, id: "not-in-bank" };
    expect(() => boardFor(spare.id, 1)).toThrow(/unknown board spec/);
  });
});
