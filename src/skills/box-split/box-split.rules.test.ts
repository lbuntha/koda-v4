import { describe, expect, it } from "vitest";
import { skill } from ".";
import { setupOf, specOf, type BoxSplitParams } from "./activities/BoxSplit";
import {
  TECHNIQUES,
  candidatesFor,
  fallbackPuzzle,
  generate,
  isFactorRich,
  judge,
  nextBox,
  rectBetween,
  shapesFor,
  solve,
  type Puzzle,
  type Rect,
} from "./internal/rules";

/* ---------- checks that do not trust the solver ---------- */

/** The answer tiles the grid, and every box holds exactly its own number, at the right size. */
function checkAnswer(p: Puzzle) {
  const cover = new Array(p.n * p.n).fill(0);
  p.answer.forEach((b, k) => {
    expect(b.r >= 0 && b.c >= 0 && b.r + b.h <= p.n && b.c + b.w <= p.n).toBe(true);
    expect(b.h * b.w).toBe(p.clues[k].area);
    let numbers = 0;
    for (let r = b.r; r < b.r + b.h; r++) {
      for (let c = b.c; c < b.c + b.w; c++) {
        cover[r * p.n + c] += 1;
        if (p.clues.some((cl) => cl.cell === r * p.n + c)) numbers += 1;
      }
    }
    expect(numbers).toBe(1);
    const cl = p.clues[k].cell;
    expect(Math.floor(cl / p.n) >= b.r && Math.floor(cl / p.n) < b.r + b.h && cl % p.n >= b.c && cl % p.n < b.c + b.w).toBe(true);
  });
  expect(cover.every((x) => x === 1)).toBe(true);
}

/** Plain backtracking over every box for every number: how many answers there are, stopping at 2. */
function countSolutions(p: Puzzle): number {
  const owner = new Int16Array(p.n * p.n).fill(-1);
  const all = p.clues.map((_, k) => candidatesFor(p, k, owner));
  let found = 0;
  const fits = (b: Rect) => {
    for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) if (owner[r * p.n + c] !== -1) return false;
    return true;
  };
  const mark = (b: Rect, v: number) => {
    for (let r = b.r; r < b.r + b.h; r++) for (let c = b.c; c < b.c + b.w; c++) owner[r * p.n + c] = v;
  };
  const go = (k: number) => {
    if (found > 1) return;
    if (k === p.clues.length) {
      if (owner.every((v) => v !== -1)) found += 1;
      return;
    }
    for (const b of all[k]) {
      if (!fits(b)) continue;
      mark(b, k);
      go(k + 1);
      mark(b, -1);
    }
  };
  go(0);
  return found;
}

describe("Box Split shapes", () => {
  it("lists every rows × columns shape that fits the grid", () => {
    expect(shapesFor(6, 6)).toEqual([[1, 6], [2, 3], [3, 2], [6, 1]]);
    expect(shapesFor(6, 4)).toEqual([[2, 3], [3, 2]]);
    expect(shapesFor(7, 6)).toEqual([]);
    expect(shapesFor(1, 3)).toEqual([[1, 1]]);
  });

  it("knows which sizes have two really different shapes", () => {
    expect([4, 6, 8, 9, 12, 16].every(isFactorRich)).toBe(true);
    expect([1, 2, 3, 5, 7, 11].some(isFactorRich)).toBe(false);
  });

  it("draws a box from either pair of opposite corners", () => {
    expect(rectBetween(5, 0, 12)).toEqual({ r: 0, c: 0, h: 3, w: 3 });
    expect(rectBetween(5, 12, 0)).toEqual({ r: 0, c: 0, h: 3, w: 3 });
    expect(rectBetween(5, 4, 20)).toEqual({ r: 0, c: 0, h: 5, w: 5 });
    expect(rectBetween(5, 7, 7)).toEqual({ r: 1, c: 2, h: 1, w: 1 });
  });
});

describe("judging a drawn box", () => {
  // 3 × 3:  [2 . 1]   answer: 2 = row 0 cols 0–1, 1 = (0,2), 6 = rows 1–2.
  //         [. . .]
  //         [. 6 .]
  const p: Puzzle = {
    n: 3,
    clues: [{ cell: 0, area: 2 }, { cell: 2, area: 1 }, { cell: 7, area: 6 }],
    answer: [{ r: 0, c: 0, h: 1, w: 2 }, { r: 0, c: 2, h: 1, w: 1 }, { r: 1, c: 0, h: 2, w: 3 }],
    hardest: "single-fit",
  };
  const none = [null, null, null];

  it("takes the right box", () => {
    expect(judge(p, { r: 0, c: 0, h: 1, w: 2 }, none)).toEqual({ kind: "right", clue: 0 });
  });
  it("calls a right-sized box in the wrong place a wrong answer", () => {
    expect(judge(p, { r: 0, c: 0, h: 2, w: 1 }, none)).toEqual({ kind: "wrong", clue: 0 });
  });
  it("refuses boxes the rules forbid, with the reason", () => {
    expect(judge(p, { r: 1, c: 0, h: 1, w: 1 }, none)).toMatchObject({ kind: "refuse", reason: "noNumber" });
    expect(judge(p, { r: 0, c: 0, h: 1, w: 3 }, none)).toMatchObject({ kind: "refuse", reason: "twoNumbers" });
    expect(judge(p, { r: 1, c: 0, h: 2, w: 2 }, none)).toMatchObject({ kind: "refuse", reason: "tooSmall", size: 4 });
    expect(judge(p, { r: 0, c: 0, h: 2, w: 2 }, none)).toMatchObject({ kind: "refuse", reason: "tooBig", size: 4 });
    expect(judge(p, { r: 0, c: 1, h: 1, w: 1 }, [p.answer[0], null, null])).toMatchObject({ kind: "refuse", reason: "overlaps" });
  });
});

describe("the solver's rules", () => {
  it("solves a single-fit puzzle with single-fit alone", () => {
    const p = fallbackPuzzle(5);
    const sol = solve(p, ["single-fit"]);
    expect(sol.solved).toBe(true);
    expect(sol.boxes).toEqual(p.answer);
  });

  it("names the rule each generated puzzle needs, and is stuck without it", () => {
    for (const t of ["only-reach", "overlap"] as const) {
      const p = generate({ size: 7, minArea: 2, maxArea: 10, maxOnes: 1, technique: t }, `needs-${t}`);
      expect(p.hardest).toBe(t);
      const easier = TECHNIQUES.slice(0, TECHNIQUES.indexOf(t));
      expect(solve(p, easier).solved).toBe(false);
      expect(solve(p, TECHNIQUES.slice(0, TECHNIQUES.indexOf(t) + 1)).solved).toBe(true);
    }
  });

  it("points a hint at a box the answer agrees with, from any point in the solve", () => {
    const p = generate({ size: 8, minArea: 2, maxArea: 14, maxOnes: 1, technique: "overlap" }, "hint-walk");
    const drawn: (Rect | null)[] = p.clues.map(() => null);
    for (let k = 0; k < p.clues.length; k++) {
      const next = nextBox(p, drawn)!;
      expect(next).not.toBeNull();
      expect(next.box).toEqual(p.answer[next.clue]);
      expect(drawn[next.clue]).toBeNull();
      drawn[next.clue] = next.box;
    }
    expect(nextBox(p, drawn)).toBeNull();
  });
});

describe("the generator", () => {
  it("throws for a spec no grid can meet", () => {
    expect(() => generate({ size: 1, maxArea: 1, technique: "single-fit" }, "x")).toThrow();
    expect(() => generate({ size: 5, minArea: 6, maxArea: 4, technique: "single-fit" }, "x")).toThrow();
  });

  it("gives the same puzzle for the same seed, and a different one for another", () => {
    const spec = { size: 6, minArea: 2, maxArea: 8, technique: "single-fit" as const };
    expect(generate(spec, "a")).toEqual(generate(spec, "a"));
    expect(generate(spec, "a")).not.toEqual(generate(spec, "b"));
  });

  it("keeps a last-resort puzzle that is itself a valid single-fit puzzle", () => {
    const p = fallbackPuzzle(6);
    checkAnswer(p);
    expect(countSolutions(p)).toBe(1);
  });

  /*
   * Every lesson, a few seeds each: the answer is a real split, it is the only
   * one (by brute force, not the solver), and the puzzle meets its lesson's spec.
   */
  for (const lesson of skill.lessons) {
    it(`meets ${lesson.id}'s spec`, () => {
      const s = setupOf(lesson.params as BoxSplitParams);
      const spec = specOf(s);
      const seeds = s.size <= 8 ? 4 : 2;
      for (let i = 0; i < seeds; i++) {
        const p = generate(spec, `${lesson.id}:${i}`);
        expect(p.n).toBe(s.size);
        checkAnswer(p);
        if (s.size <= 8) expect(countSolutions(p), `${lesson.id} seed ${i}`).toBe(1);
        const want = spec.needs ?? spec.technique;
        expect(TECHNIQUES.indexOf(p.hardest), `${lesson.id} seed ${i} needs ${want}`).toBe(TECHNIQUES.indexOf(want));
        for (const b of p.answer) {
          const size = b.h * b.w;
          expect(size, lesson.id).toBeLessThanOrEqual(spec.maxArea);
          if (size > 1) expect(size, lesson.id).toBeGreaterThanOrEqual(spec.minArea ?? 1);
          if (spec.shapes === "strips") expect(b.h === 1 || b.w === 1 || (b.h === 2 && b.w === 2), lesson.id).toBe(true);
        }
        expect(p.answer.filter((b) => b.h * b.w === 1).length).toBeLessThanOrEqual(spec.maxOnes ?? Infinity);
        if (spec.factorRich) expect(p.answer.filter((b) => isFactorRich(b.h * b.w)).length).toBeGreaterThanOrEqual(spec.factorRich);
      }
    });
  }
});
