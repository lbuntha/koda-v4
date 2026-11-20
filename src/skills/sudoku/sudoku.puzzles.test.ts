import { describe, expect, it } from "vitest";
import { skill } from ".";
import { isValidSolution, seededRandom, solvedGrid, type Size } from "./internal/board";
import { decode, drillFrom, fromBank, makeDrill, makeGame, needsBank, type Bank } from "./internal/generate";
import {
  TECHNIQUES,
  apply,
  has,
  nextStep,
  rank,
  solveLogically,
  stateOf,
  upTo,
  type Technique,
} from "./internal/techniquesForTest";
import bankJson from "./internal/bank.json";
import { techniqueHint } from "./activities/words";

const bank = bankJson as Bank;

interface Spec { size: Size; technique?: Technique; mix?: Technique[]; blanks?: number }
const specs = skill.lessons.map((l) => ({ id: l.id, activity: l.activity, q: (l.params as { question: Spec }).question }));

describe("grids", () => {
  it("makes valid solved grids of every size", () => {
    const rand = seededRandom("grids");
    for (const n of [4, 6, 9] as Size[]) for (let i = 0; i < 20; i += 1) expect(isValidSolution(solvedGrid(n, rand), n)).toBe(true);
  });
});

/**
 * Every deduction must be true. Solving known puzzles step by step, each
 * placement has to match the answer and no elimination may remove it — a
 * technique that ever did would teach a child a wrong move.
 */
describe("techniques are sound", () => {
  const boards = [
    ...Object.values(bank).flatMap((list) => list!.slice(0, 8)).map(decode),
    ...(["full-house", "hidden-single-box", "hidden-single-line", "naked-single", "pointing"] as Technique[])
      .flatMap((t) => [0, 1, 2].map((i) => makeGame({ size: 9, technique: t }, `sound:${t}:${i}`, bank).givens)),
  ];

  it.each(TECHNIQUES)("%s never contradicts the answer", (t) => {
    let used = 0;
    for (const givens of boards) {
      const answer = solveLogically(givens, 9).grid;
      const s = stateOf(givens, 9);
      for (let guard = 0; guard < 400; guard += 1) {
        const step = nextStep(s, upTo(t));
        if (!step) break;
        if (step.technique === t) used += 1;
        for (const m of step.placements) expect(answer[m.cell]).toBe(m.value);
        for (const e of step.eliminations) expect(answer[e.cell]).not.toBe(e.value);
        apply(s, step);
      }
      for (let i = 0; i < 81; i += 1) if (!s.grid[i]) expect(has(s.cand[i], answer[i])).toBe(true);
    }
    expect(used, `${t} was never exercised`).toBeGreaterThan(0);
  });
});

describe("every lesson's puzzles", () => {
  const games = specs.filter((s) => s.activity === "sudoku/game");
  const drills = specs.filter((s) => s.activity === "sudoku/spot");

  it.each(games)("$id: needs its technique, has one answer, and is quick to make", ({ q }) => {
    for (let i = 0; i < 3; i += 1) {
      const started = performance.now();
      const p = makeGame({ size: q.size, technique: q.technique!, blanks: q.blanks }, `lesson:${i}`, bank);
      expect(performance.now() - started, "too slow for a child to wait on").toBeLessThan(needsBank({ size: q.size, technique: q.technique! }) ? 300 : 2500);
      expect(isValidSolution(p.answer, p.n)).toBe(true);
      const solve = solveLogically(p.givens, p.n, upTo(q.technique!));
      expect(solve.solved).toBe(true);
      expect(solve.grid).toEqual(p.answer);
      expect(solve.hardest).toBe(q.technique);
      if (q.blanks) expect(p.givens.filter((v) => !v).length).toBeLessThanOrEqual(q.blanks);
    }
  });

  it.each(drills)("$id: stops where the technique is the next step", ({ q }) => {
    for (const t of q.mix ?? [q.technique!]) {
      const d = makeDrill({ size: q.size, technique: t }, `drill:${t}`, bank);
      expect(d.technique).toBe(t);
      expect(d.finds.length).toBeGreaterThan(0);
      for (const m of d.finds) expect(d.answer[m.cell]).toBe(m.value);
      if (d.digit) for (const m of d.finds) expect(m.value).toBe(d.digit);
      // Nothing easier works here: the technique is genuinely needed.
      const easier = TECHNIQUES.filter((x) => rank(x) < rank(t));
      expect(nextStep({ n: d.n, grid: d.grid.slice(), cand: d.cand.slice() }, easier)).toBeUndefined();
    }
  });
});

describe("the stock of hard puzzles", () => {
  it.each(Object.keys(bank))("every %s puzzle needs exactly that technique, and gives a drill", (t) => {
    for (const text of bank[t as Technique]!) {
      const givens = decode(text);
      expect(solveLogically(givens, 9).hardest).toBe(t);
      expect(drillFrom({ n: 9, givens, answer: solveLogically(givens, 9).grid, technique: t as Technique }, t as Technique)).toBeDefined();
    }
  });

  it("deals remixed copies that look new and are exactly as hard", () => {
    const a = fromBank(bank, { size: 9, technique: "x-wing" }, "one")!;
    const b = fromBank(bank, { size: 9, technique: "x-wing" }, "two")!;
    expect(a.givens).not.toEqual(b.givens);
    for (const p of [a, b]) {
      const solve = solveLogically(p.givens, 9);
      expect(solve.hardest).toBe("x-wing");
      expect(solve.grid).toEqual(p.answer);
    }
  });
});

describe("hints", () => {
  it.each(TECHNIQUES)("%s: three rungs, ending in a correct move", (t) => {
    const d = makeDrill({ size: 9, technique: t }, `hint:${t}`, bank);
    const hint = techniqueHint({ n: d.n, grid: d.grid, cand: d.cand }, d.step, d.answer, String, d.finds);
    expect(hint.rungs).toHaveLength(3);
    expect(new Set(hint.rungs).size).toBe(3);
    const target = hint.focus[2].target!;
    expect(d.answer[target.cell]).toBe(target.value);
    for (const rung of hint.rungs) expect(rung).not.toMatch(/\{|\}/);
  });
});
