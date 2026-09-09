import { describe, expect, it } from "vitest";
import { neighbors, positionKind, selectionKey, validateBoard } from "./internal/board";
import { generateLens, lensKey, LENS_MODES, type LensMode } from "./internal/lenses";

/**
 * The content tests: what the generator produces, judged independently.
 *
 * These recount every board from its own tiles rather than trusting the
 * `expected` the generator wrote. A generator that computed its answer wrongly
 * would agree with itself all day, and a driver test that presses the button
 * the engine calls correct would agree with it too.
 */

const SEEDS = Array.from({ length: 32 }, (_, i) => i * 613 + 5);

describe("every reading question is answerable from what is on the board", () => {
  it.each(LENS_MODES)("%s: the board itself is legal", (mode) => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: mode as LensMode }, seed);
      expect(() => validateBoard(lens.board)).not.toThrow();
      expect(lens.neighborhood).toEqual(neighbors(lens.target, lens.board.size));
      expect(positionKind(lens.target, lens.board.size)).toBe(lens.anchor);
    }
  });

  it("select_neighbors asks for exactly the tiles that touch the target", () => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: "select_neighbors" }, seed);
      const around = neighbors(lens.target, lens.board.size);
      expect(lens.expectedCells).toEqual(around);
      expect(lens.expected).toBe(selectionKey(around, lens.board.size));
      // The target is never one of its own neighbours. Independently checked,
      // because "a tile touches itself" is the misconception the level exists
      // to correct and a generator that believed it would look plausible.
      expect(around).not.toContain(lens.target);
      expect(around.length).toBe({ center: 8, edge: 5, corner: 3 }[lens.anchor]);
    }
  });

  it("count_same's answer is what a recount of its own board gives", () => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: "count_same" }, seed);
      const mine = lens.board.givens[lens.target];
      const counted = neighbors(lens.target, lens.board.size)
        .filter((cell) => lens.board.givens[cell] === mine).length;
      expect(counted, `seed ${seed}`).toBe(lens.expectedCount);
      expect(lens.choices).toContain(lens.expectedCount);
      expect(new Set(lens.choices).size).toBe(lens.choices!.length);
      expect(lens.choices!.every((n) => n >= 0 && n <= lens.neighborhood.length)).toBe(true);
    }
  });

  it("read_clue offers exactly one true statement, and three named traps", () => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: "read_clue" }, seed);
      const statements = lens.statements!;
      expect(statements.filter((s) => s.correct)).toHaveLength(1);
      expect(new Set(statements.map((s) => s.trap)).size).toBe(4); // three traps + undefined
      expect(statements.find((s) => s.correct)!.text).toContain(String(lens.clue!.count));
      // Nothing but the clue is coloured: a countable board answers this
      // question without reading the clue, which is the whole level.
      const painted = lens.board.givens.filter((c) => c !== null);
      expect(painted).toHaveLength(1);
    }
  });

  it("complement's answer is the neighbourhood minus the clue", () => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: "complement" }, seed);
      expect(lens.expectedCount).toBe(lens.neighborhood.length - lens.clue!.count);
      expect(lens.otherColor).not.toBe(lens.clue!.color);
      expect(lens.board.palette).toHaveLength(2);
      expect(lens.board.givens.filter((c) => c !== null)).toHaveLength(1);
    }
  });
});

describe("the constraints a lesson sets are constraints, not suggestions", () => {
  it("keeps the target at the positions a lesson allows", () => {
    for (const seed of SEEDS) {
      expect(generateLens({ mode: "select_neighbors", anchors: ["center"] }, seed).anchor).toBe("center");
      expect(["edge", "corner"]).toContain(
        generateLens({ mode: "select_neighbors", anchors: ["edge", "corner"] }, seed).anchor,
      );
    }
  });

  it("keeps count_same inside the band it was given", () => {
    for (const seed of SEEDS) {
      const lens = generateLens({ mode: "count_same", anchors: ["center"], minSame: 2, maxSame: 4 }, seed);
      expect(lens.expectedCount).toBeGreaterThanOrEqual(2);
      expect(lens.expectedCount).toBeLessThanOrEqual(4);
    }
  });

  it("refuses a band a corner cannot satisfy rather than quietly relaxing it", () => {
    // The Phase 0 register's standing trap: a generator that cannot meet its
    // specification and returns something close enough teaches a different
    // lesson than the one authored, and says nothing.
    expect(() => generateLens({ mode: "count_same", anchors: ["corner"], minSame: 5, maxSame: 6 }, 1))
      .toThrow(/touches at most 3/);
  });

  it("refuses a three-colour complement instead of answering with one number", () => {
    expect(() => generateLens({ mode: "complement", palette: ["orange", "navy", "cyan"] }, 1))
      .toThrow(/two-color/);
    expect(() => generateLens({ mode: "select_neighbors", anchors: ["middle" as "center"] }, 1))
      .toThrow(/Unknown board position/);
  });
});

describe("a round does not ask the same question twice", () => {
  it("varies while the space is big enough, and repeats honestly when it is not", () => {
    const seen = new Set<string>();
    const drawn = Array.from({ length: 5 }, (_, i) =>
      generateLens({ mode: "count_same", anchors: ["center", "edge", "corner"] }, i * 1009 + 17, { seen }),
    );
    expect(new Set(drawn.map(lensKey)).size, "five distinct questions in a round").toBe(5);
    expect(drawn.every((l) => !l.generation.repeated)).toBe(true);

    /* A corner complement is the smallest space this engine has: four corners
       and four possible counts, with every other tile blank. Sixteen distinct
       questions exist, so a longer round genuinely runs out — and saying so
       beats throwing at a child mid-round.

       `select_neighbors` is not that case, though it looks like it: its board
       is fully coloured, so a corner target still has 2^9 distinct boards. */
    const tiny = new Set<string>();
    const many = Array.from({ length: 40 }, (_, i) =>
      generateLens({ mode: "complement", anchors: ["corner"] }, i * 7 + 3, { seen: tiny }),
    );
    expect(new Set(many.map(lensKey)).size, "sixteen distinct corner complements exist").toBeLessThanOrEqual(16);
    expect(many.some((l) => l.generation.repeated), "a tiny space eventually repeats").toBe(true);
    expect(many.every((l) => l.neighborhood.length === 3)).toBe(true);
  });

  it("is reproducible from its seed", () => {
    for (const mode of LENS_MODES) {
      const a = generateLens({ mode: mode as LensMode }, 4242);
      const b = generateLens({ mode: mode as LensMode }, 4242);
      expect(lensKey(a)).toBe(lensKey(b));
      expect(a.expected).toBe(b.expected);
    }
  });

  it("rejects a seed it cannot reproduce from", () => {
    expect(() => generateLens({ mode: "count_same" }, 1.5)).toThrow(/safe integer/);
  });
});
