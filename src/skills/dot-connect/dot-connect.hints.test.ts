import { describe, expect, it } from "vitest";
import { skill } from ".";
import { buildQuestion, type ConnectParams } from "./activities/ConnectBoard";
import { BANK } from "./internal/bank";
import { checkLines } from "./internal/check";
import { emptyLines } from "./internal/drawing";
import { exitsOf } from "./internal/features";
import { connectHints, describeRoute, focusColour, forcedDot } from "./internal/hints";
import { letterOf } from "./internal/i18n";

const MAX_WORDS = 20;
const words = (text: string) => text.trim().split(/\s+/).length;
const teaching = skill.lessons.filter((l) => !(l.params as { question: { practice?: boolean } }).question.practice);

/** Follows "2 right, 1 down" from a cell, independently of how it was written. */
function follow(start: number, size: number, moves: string): number[] {
  const cells = [start];
  for (const [, n, dir] of moves.matchAll(/(\d+) (right|left|up|down)/g)) {
    const d = dir === "right" ? 1 : dir === "left" ? -1 : dir === "up" ? -size : size;
    for (let i = 0; i < Number(n); i += 1) cells.push(cells[cells.length - 1] + d);
  }
  return cells;
}

describe("Dot Connect hints", () => {
  it("gives every teaching lesson three short rungs on a fresh board", () => {
    const failures = teaching.flatMap((lesson) => {
      const params = { ...(lesson.params as ConnectParams), question: { ...(lesson.params as { question: object }).question, offset: 0 } };
      const q = buildQuestion(params, 1);
      const tip = (lesson.params as { play?: { kidTip?: string } }).play?.kidTip;
      const ladder = connectHints(q.board, emptyLines(q.board), { mustFill: q.mustFill, kidTip: tip });
      if (ladder.length !== 3) return [`${lesson.id}: ${ladder.length} rungs`];
      return ladder.flatMap((rung, i) => (words(rung) > MAX_WORDS ? [`${lesson.id} rung ${i + 1}: ${rung}`] : []));
    });
    expect(failures).toEqual([]);
  });

  it("the route in the last rung really runs along the answer, for every board in the bank", () => {
    for (const [id, boards] of Object.entries(BANK)) {
      for (const board of boards) {
        board.solution.forEach((line) => {
          const said = describeRoute(line);
          const walked = follow(line[0], board.size, said);
          expect(walked, `${id}: ${said}`).toEqual(line.slice(0, walked.length));
          // Short routes are given whole; long ones say there is more.
          if (walked.length < line.length) expect(said).toMatch(/and on from there/);
        });
      }
    }
  });

  it("names the colour to work on, and moves on once it is drawn", () => {
    const board = BANK["five-pairs"][0];
    const lines = emptyLines(board);
    expect(focusColour(board, lines, true)).toBe(0);
    lines[0] = board.solution[0].slice();
    expect(focusColour(board, lines, true)).toBe(1);
    expect(connectHints(board, lines, { mustFill: true })[2]).toMatch(new RegExp(`^Draw ${letterOf(1)} `));
  });

  it("points at empty squares when every pair is joined but the board is not full", () => {
    const board = BANK["fill-every-square"][0];
    // Join every pair straight from its dot to its twin wherever the answer is a
    // single line of squares; otherwise use the answer — then empty one square
    // by joining a pair the short way, if the board allows it.
    const lines = board.solution.map((l) => l.slice());
    const k = lines.findIndex((l) => l.length > 3);
    const [a, b] = board.pairs[k];
    if (Math.abs(a - b) === 1 || Math.abs(a - b) === board.size) {
      lines[k] = [a, b];
      const check = checkLines(board, lines);
      expect(check.covered).toBeLessThan(check.open);
      expect(connectHints(board, lines, { mustFill: true })[1]).toMatch(/still empty/);
    }
  });

  it("names a dot with one way out only when it really has one", () => {
    for (const board of BANK["one-way-out"]) {
      const k = forcedDot(board, emptyLines(board));
      expect(k).toBeGreaterThanOrEqual(0);
      expect(board.pairs[k].some((dot) => exitsOf(board, dot).length === 1)).toBe(true);
    }
  });

  it("talks about the step count on Exact Steps, and the bridge on Bridges", () => {
    const steps = BANK["exact-steps"][0];
    expect(connectHints(steps, emptyLines(steps), { mustFill: true })[1])
      .toMatch(new RegExp(`${letterOf(steps.steps!.pair)} must take exactly ${steps.steps!.steps} steps`));
    const bridge = BANK.bridges[0];
    expect(connectHints(bridge, emptyLines(bridge), { mustFill: true })[1]).toMatch(/bridge both ways/);
  });
});
