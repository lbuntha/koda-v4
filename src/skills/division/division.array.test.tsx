import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  arrayBlockedBecause,
  buildArrayQuestion,
  rowsOf,
  type ArrayMode,
  type ArrayQuestion,
} from "./internal/data/divisionArray";

/** The three techniques on the array, each driven the way a child drives it. */

const grid = skill.activities.array;

const questions = (mode: ArrayMode, n = 200): ArrayQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildArrayQuestion({ mode }, mode, i, seen));
};

/** Build the array the question asked for, then answer it. */
const buildAndAnswer = async (h: ActivityHarness): Promise<void> => {
  const label = h.screen.getByTestId("array").getAttribute("aria-label") ?? "";
  const wanted = /Put all (\d+) into (\d+) equal rows/.exec(h.text());
  if (wanted) {
    const target = Number(wanted[2]);
    for (let i = 0; i < target; i += 1) await h.press("Add a row");
  }
  await h.press("Place the rest");
  const after = h.screen.getByTestId("array").getAttribute("aria-label") ?? "";
  const rows = Number(/Array with (\d+) rows/.exec(after)?.[1] ?? "0");
  const placed = Number(/and (\d+) placed/.exec(after)?.[1] ?? "0");
  expect(label).toBeTruthy();
  const answer = rows > 0 ? Math.floor(placed / rows) : 0;
  await h.press(String(answer));
};

describe("total_and_side — the row count is given", () => {
  it("always comes out even, and names the rows to build", () => {
    for (const q of questions("total_and_side")) {
      expect(q.remainder).toBe(0);
      expect(q.targetRows).toBe(q.divisor);
      expect(q.divisor * q.quotient).toBe(q.dividend);
      expect(q.rowWidth).toBeUndefined();
    }
  });

  it("will not take an answer until the array is the shape it asked for", () => {
    const [q] = questions("total_and_side", 1);
    expect(arrayBlockedBecause(q, 0, 0)).toBe("wrong-row-count");
    expect(arrayBlockedBecause(q, q.divisor, 0)).toBe("not-all-placed");
    expect(arrayBlockedBecause(q, q.divisor, q.dividend)).toBe(null);
  });

  it("refuses an answer from a child who has built nothing", async () => {
    const h = renderActivity(grid, { params: { question: { mode: "total_and_side" } } });
    const answer = h.buttons().find((b) => /^\d+$/.test(b));
    if (answer) await h.press(answer);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Make the number of rows the question asked for.");
    h.unmount();
  });

  it("runs a full round once the array is actually built", async () => {
    await expectStandardRound(grid, buildAndAnswer, {
      params: { question: { mode: "total_and_side", divisorRange: [2, 4], quotientRange: [2, 5], totalMax: 20 } },
      questions: 5,
    });
  });
});

describe("two_divisions — one array, both sentences", () => {
  it("never draws a square, because a square says the same thing twice", () => {
    for (const q of questions("two_divisions")) expect(q.quotient).not.toBe(q.divisor);
  });

  it("offers four pairs with exactly one true one", () => {
    for (const q of questions("two_divisions")) {
      const pairs = q.pairs ?? [];
      expect(pairs).toHaveLength(4);
      expect(new Set(pairs).size).toBe(4);
      expect(pairs.filter((p) => p === q.expected)).toHaveLength(1);
    }
  });

  it("makes every wrong pair wrong in its second half only", () => {
    for (const q of questions("two_divisions", 60)) {
      for (const pair of q.pairs ?? []) {
        const [first] = pair.split("   and   ");
        // The first sentence is true in every option, so a child cannot discard
        // a pair without reading the half the level is about.
        expect(first).toBe(`${q.dividend} ÷ ${q.divisor} = ${q.quotient}`);
      }
    }
  });
});

describe("partial_row — the short last row", () => {
  it("always leaves a short row, never a clean rectangle", () => {
    for (const q of questions("partial_row")) {
      expect(q.remainder).toBeGreaterThan(0);
      expect(q.remainder).toBeLessThan(q.divisor);
      expect(q.rowWidth).toBe(q.divisor);
    }
  });

  it("lays the counters out so the last row is the remainder", () => {
    for (const q of questions("partial_row", 60)) {
      const layout = rowsOf(q.dividend, q.divisor);
      expect(layout).toHaveLength(q.quotient + 1);
      expect(layout.at(-1)).toBe(q.remainder);
      expect(layout.slice(0, -1).every((n) => n === q.divisor)).toBe(true);
    }
  });

  it("does not gate on a row count, because the rows are the answer", () => {
    const [q] = questions("partial_row", 1);
    expect(q.targetRows).toBe(0);
    expect(arrayBlockedBecause(q, 0, q.dividend)).toBe(null);
    expect(arrayBlockedBecause(q, 0, q.dividend - 1)).toBe("not-all-placed");
  });
});
