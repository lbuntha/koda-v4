import { describe, expect, it } from "vitest";
import { skill } from ".";
import {
  countSolutions,
  evaluate,
  generatePuzzle,
  isSolved,
  lineCells,
  lines,
  normalise,
  type CrossSpec,
  type Op,
  type Puzzle,
} from "./internal/grid";

/** Left to right, written here rather than imported, so the generator is checked by something it did not write. */
function leftToRight(values: number[], ops: Op[]): number {
  return ops.reduce((acc, op, i) => {
    const b = values[i + 1];
    return op === "+" ? acc + b : op === "-" ? acc - b : op === "*" ? acc * b : acc / b;
  }, values[0]);
}

function everyLine(p: Puzzle): { values: number[]; ops: Op[]; result: number }[] {
  return lines(p).map((line) => {
    const cells = lineCells(p, line).map(([r, c]) => p.nums[r][c] as number);
    return { values: cells.slice(0, -1), ops: (line.kind === "row" ? p.rowOps : p.colOps)[line.index], result: cells[cells.length - 1] };
  });
}

const specOf = (lesson: (typeof skill.lessons)[number]): CrossSpec => (lesson.params as { question: CrossSpec }).question;

describe("the order of operations", () => {
  it("does times and divide first", () => {
    expect(evaluate([2, 3, 4], ["+", "*"])).toBe(14);
    expect(evaluate([12, 3, 1], ["/", "-"])).toBe(3);
    expect(evaluate([10, 4, 2], ["-", "/"])).toBe(8);
    expect(evaluate([7, 2], ["-"])).toBe(5);
  });
});

describe("every lesson's puzzles", () => {
  it.each(skill.lessons.map((l) => [l.id, l] as const))("%s: true, single-answer, within its spec", (_, lesson) => {
    const spec = specOf(lesson);
    const s = normalise(spec);
    for (let i = 0; i < 12; i += 1) {
      const p = generatePuzzle(spec, `${lesson.id}-${i}`);
      const tag = `${lesson.id} #${i}`;

      // The shape the lesson asked for — no silent fallback to an easier puzzle.
      expect(p.size, tag).toBe(s.size);
      expect(p.slots.filter((x) => x.kind === "num"), tag).toHaveLength(s.blanks);
      expect(p.slots.filter((x) => x.kind === "op"), tag).toHaveLength(s.signs);

      const used = new Set([...p.rowOps.flat(), ...p.colOps.flat()]);
      for (const op of used) expect(s.ops, tag).toContain(op);
      for (const op of s.mustUse) expect(used.has(op), `${tag} lacks ${op}`).toBe(true);

      for (const { values, ops, result } of everyLine(p)) {
        // True as written, and the same read left to right.
        expect(evaluate(values, ops), tag).toBe(result);
        expect(leftToRight(values, ops), tag).toBe(result);
        for (const v of [...values, result]) {
          expect(Number.isInteger(v), tag).toBe(true);
          expect(v, tag).toBeGreaterThanOrEqual(s.allowZero ? 0 : 1);
          expect(v, tag).toBeLessThanOrEqual(s.max);
        }
        if (!s.allowZero) expect(result, tag).toBeGreaterThan(0);
      }

      expect(isSolved(p, p.answers), tag).toBe(true);
      expect(countSolutions(p, 3), `${tag} has more than one answer`).toBe(1);
      expect(p.bank.slice().sort((a, b) => a - b)).toEqual(
        p.slots.flatMap((x, k) => (x.kind === "num" ? [Number(p.answers[k])] : [])).sort((a, b) => a - b),
      );
    }
  });

  it("closes the small grid at its corner", () => {
    const p = generatePuzzle({ ops: ["+", "-"], max: 20, blanks: 2 }, "corner");
    expect(p.closed).toBe(true);
    expect(lines(p)).toHaveLength(6);
    expect(p.nums[2][2]).not.toBeNull();
  });

  it("leaves the big grid open at its corner", () => {
    const p = generatePuzzle({ size: 3, ops: ["+", "-"], max: 30, blanks: 4 }, "open");
    expect(p.closed).toBe(false);
    expect(lines(p)).toHaveLength(6);
    expect(p.nums[3][3]).toBeNull();
  });
});

describe("randomness", () => {
  it("gives the same puzzle for the same seed", () => {
    const spec: CrossSpec = { ops: ["+", "-"], max: 20, blanks: 3 };
    expect(generatePuzzle(spec, "a")).toEqual(generatePuzzle(spec, "a"));
  });

  it("gives different puzzles for different seeds", () => {
    const spec: CrossSpec = { ops: ["+"], max: 20, blanks: 3 };
    const boards = new Set(Array.from({ length: 10 }, (_, i) => JSON.stringify(generatePuzzle(spec, `s${i}`).nums)));
    expect(boards.size).toBeGreaterThan(7);
  });

  it("falls back to a playable puzzle when a spec cannot be met, rather than hang", () => {
    const p = generatePuzzle({ ops: ["*"], max: 5, blanks: 2, mustUse: ["/"] }, "impossible");
    expect(isSolved(p, p.answers)).toBe(true);
    expect(countSolutions(p, 2)).toBe(1);
  });
});

describe("judging an answer", () => {
  it("checks the lines, not the answer key", () => {
    const p = generatePuzzle({ ops: ["+"], max: 10, blanks: 2 }, "judge");
    expect(isSolved(p, p.answers)).toBe(true);
    expect(isSolved(p, p.answers.map(() => null))).toBe(false);
    const wrong = p.answers.slice();
    wrong[0] = String(Number(wrong[0]) + 1);
    expect(isSolved(p, wrong)).toBe(false);
  });
});
