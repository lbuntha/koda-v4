import { describe, expect, it } from "vitest";
import { answerKey, boardKey, neighbors, positionKind, selectionKey, validateBoard, type Board, type Color } from "./internal/board";
import { deduce, type ProofStep } from "./internal/deduction";
import { enumerateSolutions, isSolution } from "./internal/validation";
import { generatePuzzle, type PuzzleSpec } from "./internal/puzzles";
import { PALETTE } from "./internal/palette";
import { boardLayout, motionPolicy } from "./internal/layout";

/** Authored independently from the generator, using the worked examples in the plan. */
function fixture(rows: string[], palette: Color[] = ["orange", "navy"]): Board {
  const tokens = rows.flatMap(row => row.split(" "));
  const colors: Record<string, Color> = { O: "orange", N: "navy", C: "cyan" };
  return { size: rows.length as 3 | 4, palette,
    givens: tokens.map(t => t.startsWith("?") ? null : colors[t[0]]),
    clues: tokens.flatMap((t, i) => /^\w\d$/.test(t) ? [{ id: `c${i}`, cell: i, color: colors[t[0]], count: Number(t[1]) }] : []) };
}
const OVERLAP = fixture(["N O ?A O2", "N ?B O4 ?C", "O ?D N4 O", "O O N N"]);
const THREE = fixture(["O0 N0 C C", "C ?X C C", "C C C C", "C C C C"], ["orange", "navy", "cyan"]);
function freeze<T>(obj: T): T {
  if (obj && typeof obj === "object") { Object.freeze(obj); Object.values(obj).forEach(freeze); }
  return obj;
}
/** Replay each rule from its recorded evidence, with a separate coordinate calculation. */
function checkCertificate(board: Board, steps: readonly ProofStep[]) {
  const domains = board.givens.map(c => c === null ? [...board.palette] : [c]);
  for (const step of steps) {
    for (const evidence of step.evidence) {
      const clue = board.clues.find(c => c.id === evidence.clueId)!;
      const adjacent = domains.flatMap((_, i) => i !== clue.cell && Math.abs(Math.floor(i / board.size) - Math.floor(clue.cell / board.size)) <= 1 && Math.abs(i % board.size - clue.cell % board.size) <= 1 ? [i] : []);
      const matches = adjacent.filter(i => domains[i].length === 1 && domains[i][0] === clue.color);
      const candidates = adjacent.filter(i => domains[i].length > 1 && domains[i].includes(clue.color));
      expect(evidence.knownMatches).toEqual(matches);
      expect(evidence.candidates).toEqual(candidates);
      expect(evidence.remaining).toBe(clue.count - matches.length);
    }
    const [a, b] = step.evidence;
    const cells = b ? b.candidates.filter(i => !a.candidates.includes(i)) : a.candidates;
    if (b) {
      expect(a.color).toBe(b.color);
      expect(a.candidates.every(i => b.candidates.includes(i))).toBe(true);
    }
    const required = b ? b.remaining - a.remaining : a.remaining;
    expect([0, cells.length]).toContain(required);
    expect(step.changes.map(c => c.cell)).toEqual(cells);
    for (const change of step.changes) {
      expect(change.before).toEqual(domains[change.cell]);
      const expected = required === 0 ? domains[change.cell].filter(c => c !== step.color) : [step.color];
      expect(change.after).toEqual(expected);
      expect(change.after.length).toBeLessThan(change.before.length);
      domains[change.cell] = [...change.after];
    }
  }
  expect(domains.every(d => d.length === 1)).toBe(true);
}

describe("Color Sweeper geometry and public schema", () => {
  it("includes diagonals, excludes self, and never wraps at edges", () => {
    expect(neighbors(0, 3)).toEqual([1, 3, 4]);
    expect(neighbors(1, 3)).toEqual([0, 2, 3, 4, 5]);
    expect(neighbors(4, 3)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(neighbors(15, 4)).toEqual([10, 11, 14]);
    expect(positionKind(0, 4)).toBe("corner");
    expect(positionKind(2, 4)).toBe("edge");
    expect(positionKind(5, 4)).toBe("center");
    expect(() => neighbors(-1, 3)).toThrow(); expect(() => neighbors(16, 4)).toThrow();
  });
  it("rejects out-of-bounds clues, repeated IDs/positions, impossible counts and unsupported colors", () => {
    const board = fixture(["O0 N N", "N N N", "N N N"]);
    expect(() => validateBoard({ ...board, clues: [{ ...board.clues[0], count: 4 }] })).toThrow();
    expect(() => validateBoard({ ...board, clues: [...board.clues, board.clues[0]] })).toThrow();
    expect(() => validateBoard({ ...board, clues: [{ ...board.clues[0], color: "navy" }] })).toThrow();
    expect(() => validateBoard({ ...board, palette: ["orange", "orange"] })).toThrow();
    expect(() => validateBoard({ ...board, givens: ["cyan", ...board.givens.slice(1)] })).toThrow();
  });
  it("canonicalizes selected sets and board identity without changing caller data", () => {
    expect(selectionKey([4, 1, 3, 1], 3)).toBe("1,3,4");
    expect(boardKey(OVERLAP)).toBe(boardKey({ ...OVERLAP, clues: [...OVERLAP.clues].reverse(), palette: [...OVERLAP.palette].reverse() }));
    expect(() => answerKey(OVERLAP, OVERLAP.givens)).toThrow(/incomplete/);
  });
});

describe("independent solution validation", () => {
  it("counts diagonals independently in a known-answer example", () => {
    expect(enumerateSolutions(fixture(["O N O", "N O3 N", "N O N"])).status).toBe("unique");
    expect(enumerateSolutions(fixture(["O N O", "N O4 N", "N O N"])).status).toBe("none");
  });
  it("identifies the plan's intentionally ambiguous example", () => {
    const board = fixture(["O N N", "?A O2 ?B", "N N N"]);
    expect(enumerateSolutions(board).status).toBe("multiple");
    expect(deduce(board).status).toBe("stalled");
  });
  it("never treats one discovered answer before budget exhaustion as unique", () => {
    const board = fixture(["O N N", "N N N", "N N ?"]);
    const result = enumerateSolutions(board, { maxNodes: 2 });
    expect(result.solutions).toHaveLength(1);
    expect(result.status).toBe("budget-exhausted");
    expect(() => enumerateSolutions(board, { maxNodes: 0 })).toThrow();
  });
  it("rejects changing or erasing fixed clues", () => {
    const altered = [...THREE.givens]; altered[0] = null;
    expect(() => deduce(THREE, altered)).toThrow(/Fixed/);
    expect(() => enumerateSolutions(THREE, { assigned: altered })).toThrow(/Fixed/);
  });
});

describe("deduction certificates from visible evidence", () => {
  it("solves zero and full without counting the middle itself", () => {
    for (const [count, color] of [[0, "navy"], [8, "orange"]] as const) {
      const board = fixture(["? ? ?", `? O${count} ?`, "? ? ?"]);
      const proof = deduce(board);
      expect(proof.status).toBe("solved");
      expect(proof.steps[0].changes.every(c => c.after[0] === color)).toBe(true);
      checkCertificate(board, proof.steps);
    }
  });
  it("subtracts shared residual evidence and then solves the whole overlap example", () => {
    const proof = deduce(freeze(OVERLAP));
    expect(deduce(OVERLAP, OVERLAP.givens, { overlap: false }).status).toBe("stalled");
    expect(proof.steps[0].rule).toBe("overlap-exclude");
    expect(proof.steps[0].changes.map(c => c.cell)).toEqual([5, 9]);
    expect(proof.domains[2]).toEqual(["navy"]);
    expect(proof.domains[7]).toEqual(["orange"]);
    expect(proof.steps.at(-1)!.depth).toBeGreaterThanOrEqual(3);
    checkCertificate(OVERLAP, proof.steps);
  });
  it("retains two candidates after the first exclusion with three colors", () => {
    const result = deduce(freeze(THREE));
    expect(result.steps[0].changes[0].after).toEqual(["navy", "cyan"]);
    expect(result.steps[1].changes[0].before).toEqual(["navy", "cyan"]);
    expect(result.domains[5]).toEqual(["cyan"]);
    checkCertificate(THREE, result.steps);
  });
  it("never reads a hidden solution even if one is attached at runtime", () => {
    const board = { ...THREE };
    Object.defineProperty(board, "solution", { get() { throw new Error("Hidden answer accessed"); } });
    expect(deduce(board).status).toBe("solved");
  });
  it("reports a learner contradiction from visible constraints without repairing it", () => {
    const board = fixture(["O N O", "N O2 ?", "N N N"]), painted = [...board.givens];
    painted[5] = "orange";
    const proof = deduce(board, painted);
    expect(proof.status).toBe("contradiction"); expect(proof.violatedClueIds).toEqual(["c4"]);
    expect(painted[5]).toBe("orange");
  });
});

const specifications: PuzzleSpec[] = [
  ...(["zero", "full"] as const).flatMap(mode => (["corner", "edge", "center"] as const).map(anchor => ({ mode, anchor }))),
  ...(["met", "one", "all"] as const).flatMap(remainingCase => (["corner", "edge", "center"] as const).map(anchor => ({ mode: "remaining" as const, remainingCase, anchor }))),
  { mode: "chain", size: 3 }, { mode: "chain", size: 4 }, { mode: "overlap" }, { mode: "three_color" },
];
describe("bounded technique-directed generation", () => {
  it.each(specifications)("certifies 32 seeds for $mode / $anchor / $remainingCase / $size", spec => {
    for (let seed = 0; seed < 32; seed++) {
      const puzzle = generatePuzzle(freeze(spec), seed);
      expect(enumerateSolutions(puzzle.board).status).toBe("unique");
      expect(isSolution(puzzle.board, puzzle.solution)).toBe(true);
      expect(puzzle.expected).toBe(answerKey(puzzle.board, puzzle.solution));
      checkCertificate(puzzle.board, puzzle.proof);
      if (spec.anchor) expect(positionKind(puzzle.board.clues[0].cell, puzzle.board.size)).toBe(spec.anchor);
      if (spec.mode === "overlap") expect(deduce(puzzle.board, puzzle.board.givens, { overlap: false }).status).toBe("stalled");
      if (spec.mode === "chain") expect(puzzle.proof.some(s => s.depth >= 2)).toBe(true);
    }
  });
  it.each(specifications)("preserves $mode constraints when forced to use its fallback", spec => {
    const puzzle = generatePuzzle(spec, 77, { maxAttempts: 0 });
    expect(puzzle.generation.source).toBe("fallback");
    expect(puzzle.generation.attempts).toBe(0);
    expect(isSolution(puzzle.board, puzzle.solution)).toBe(true);
    checkCertificate(puzzle.board, puzzle.proof);
  });
  it("is deterministic and works with an alternative two-color palette", () => {
    const spec: PuzzleSpec = { mode: "remaining", palette: ["navy", "cyan"] };
    expect(generatePuzzle(spec, 43)).toEqual(generatePuzzle(spec, 43));
    expect(generatePuzzle(spec, 43).solution.every(c => c !== "orange")).toBe(true);
  });
  it("exhausts small spaces without hanging; the caller owns reset/round memory", () => {
    const seen = new Set<string>(), spec: PuzzleSpec = { mode: "zero", anchor: "center" };
    for (let i = 0; i < 12; i++) {
      const puzzle = generatePuzzle(spec, i, { seen });
      expect(puzzle.generation.repeated).toBe(i >= 2);
    }
    expect(seen.size).toBe(2);
    seen.clear(); expect(generatePuzzle(spec, 0, { seen }).generation.repeated).toBe(false);
  });
  it.each([
    { mode: "unknown" }, { mode: "zero", size: 4 }, { mode: "overlap", size: 3 },
    { mode: "overlap", anchor: "corner" }, { mode: "full", palette: ["orange", "navy", "cyan"] },
    { mode: "three_color", palette: ["orange", "navy"] }, { mode: "zero", minUnknowns: 9 },
    { mode: "chain", minUnknowns: 3 }, { mode: "remaining", remainingCase: "invalid" },
    { mode: "remaining", anchor: "corner", remainingCase: "all", knownMatches: 2 },
    { mode: "full", knownMatches: 2 }, { mode: "zero", minUnknowns: 2, maxUnknowns: 1 },
  ])("throws rather than relaxing impossible authoring: %j", spec => {
    expect(() => generatePuzzle(spec as PuzzleSpec, 1)).toThrow();
  });
  it("bounds seed and search budgets", () => {
    expect(() => generatePuzzle({ mode: "zero" }, NaN)).toThrow();
    expect(() => generatePuzzle({ mode: "zero" }, 0, { maxAttempts: 65 })).toThrow();
    expect(() => generatePuzzle({ mode: "zero" }, 0, { maxAttempts: -1 })).toThrow();
  });
});

function luminance(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
describe("layout, color identities and motion foundations", () => {
  it("fits both boards within a 360px viewport with host gutters and preserves 44px targets", () => {
    for (const size of [3, 4] as const) {
      const layout = boardLayout(size, 296);
      expect(layout.tile).toBeGreaterThanOrEqual(44); expect(layout.width).toBeLessThanOrEqual(296);
      expect(layout.scrollInside).toBe(false);
    }
    expect(boardLayout(4, 180).scrollInside).toBe(true);
    expect(boardLayout(4, 180).tile).toBe(44);
    expect(() => boardLayout(4, 0)).toThrow();
  });
  it("has distinct permanent symbols and readable clue text on every apparatus color", () => {
    expect(new Set(Object.values(PALETTE).map(c => c.symbol)).size).toBe(3);
    expect(new Set(Object.values(PALETTE).map(c => c.letter)).size).toBe(3);
    for (const color of Object.values(PALETTE)) {
      const a = luminance(color.fill), b = luminance(color.ink);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("removes instructional motion in practice and all movement under reduced motion", () => {
    expect(motionPolicy(false, false)).toEqual({ animateInput: true, animateHint: true, staticHintAvailable: true, blockInputUntilAnimationEnds: false });
    expect(motionPolicy(true, false)).toEqual({ animateInput: true, animateHint: false, staticHintAvailable: false, blockInputUntilAnimationEnds: false });
    expect(motionPolicy(false, true)).toEqual({ animateInput: false, animateHint: false, staticHintAvailable: true, blockInputUntilAnimationEnds: false });
    expect(motionPolicy(true, true)).toEqual({ animateInput: false, animateHint: false, staticHintAvailable: false, blockInputUntilAnimationEnds: false });
  });
});
