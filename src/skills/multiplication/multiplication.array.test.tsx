import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type ArrayMode } from "./activities/ArrayGrid";

/**
 * ArrayGrid, driven the way a child drives it.
 *
 * Every answer is worked out from the grid's own accessible description — "4
 * rows of 6" — and never read back from the engine's answer key.
 */

const array = skill.activities.array;

const labels = (h: ActivityHarness): string[] =>
  h.screen.getAllByRole("button").map((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim());

/** The array on screen, read off the grid's own label. */
const shape = (h: ActivityHarness): { rows: number; cols: number } => {
  const grid = h.screen.getAllByRole("img").map((el) => el.getAttribute("aria-label") ?? "");
  const found = grid.map((label) => /^(\d+) rows of (\d+)$/.exec(label)).find(Boolean);
  expect(found, `no array on screen; saw ${JSON.stringify(grid)}`).toBeTruthy();
  return { rows: Number(found![1]), cols: Number(found![2]) };
};

const render = (mode: ArrayMode, params: Record<string, unknown> = {}) =>
  renderActivity(array, { params: { mode, questionsPerRound: 5, ...params } });

/** Grow the array to a wanted shape with the ± controls. */
async function resizeTo(h: ActivityHarness, rows: number, cols: number): Promise<void> {
  for (let guard = 0; guard < 60; guard += 1) {
    const now = shape(h);
    if (now.rows === rows && now.cols === cols) return;
    if (now.rows < rows) await h.press("Add a row");
    else if (now.rows > rows) await h.press("Remove a row");
    else if (now.cols < cols) await h.press("Add a column");
    else await h.press("Remove a column");
  }
  throw new Error("the array never reached its shape");
}

/** The shape the prompt is asking to be built, taken from the scaffold line. */
const wanted = (h: ActivityHarness): { rows: number; cols: number } => {
  const match = /You need (\d+) rows of (\d+)/.exec(h.text());
  expect(match, "build_array states the shape it wants").toBeTruthy();
  return { rows: Number(match![1]), cols: Number(match![2]) };
};

const drivers: Record<ArrayMode, (h: ActivityHarness) => Promise<void>> = {
  build_array: async (h) => {
    const target = wanted(h);
    await resizeTo(h, target.rows, target.cols);
    await h.press(`${target.rows * target.cols} squares`);
  },
  read_array: async (h) => {
    const { rows, cols } = shape(h);
    await h.press(`${rows * cols} squares`);
  },
  commute: async (h) => {
    const before = shape(h);
    await h.press("Turn the array");
    const after = shape(h);
    // Turning swaps the sides and leaves the count alone — which is the answer.
    expect(after.rows).toBe(before.cols);
    expect(after.cols).toBe(before.rows);
    expect(after.rows * after.cols).toBe(before.rows * before.cols);
    await h.press("No — the same squares, just turned round.");
  },
  array_to_equation: async (h) => {
    const { rows, cols } = shape(h);
    await h.press(`${rows} × ${cols} = ${rows * cols}`);
    await h.press(`${cols} × ${rows} = ${rows * cols}`);
    await h.press("Check");
  },
  missing_dimension: async (h) => {
    /*
     * From the prompt, not from the first number followed by "squares".
     * The running-total badge also says "squares", and it moves as the child
     * resizes — reading that instead would make the driver chase its own tail.
     */
    const total = Number(/(\d+) squares in/.exec(h.text())![1]);
    const growsRows = labels(h).includes("Add a row");
    const start = shape(h);
    const known = growsRows ? start.cols : start.rows;
    const needed = total / known;
    await resizeTo(h, growsRows ? needed : start.rows, growsRows ? start.cols : needed);
    await h.press("Check");
  },
  split_array: async (h) => {
    const { rows, cols } = shape(h);
    const cut = labels(h).find((l) => /^Cut after row \d+$/.test(l))!;
    await h.press(cut);
    await h.press(`${rows * cols} squares`);
  },
};

describe("every array mode plays a complete round", () => {
  for (const [mode, drive] of Object.entries(drivers) as [ArrayMode, (h: ActivityHarness) => Promise<void>][]) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(array, drive, {
        // Small arrays: `build_array` costs one press per row and column.
        params: { mode, rowRange: mode === "split_array" ? [6, 7] : [2, 3], colRange: [2, 3] },
        questions: 5,
      });
      h.unmount();
    });
  }
});

describe("the array is resized, not redrawn", () => {
  it("keeps the same grid and changes its shape", async () => {
    const h = render("build_array", { rowRange: [3, 3], colRange: [3, 3] });
    expect(shape(h)).toEqual({ rows: 1, cols: 1 });
    await h.press("Add a row");
    expect(shape(h)).toEqual({ rows: 2, cols: 1 });
    await h.press("Add a column");
    expect(shape(h)).toEqual({ rows: 2, cols: 2 });
    h.unmount();
  });

  it("will not shrink below one, or grow past the apparatus", async () => {
    const h = render("build_array", { rowRange: [2, 2], colRange: [2, 2] });
    await h.press("Remove a row");
    expect(shape(h).rows).toBe(1);
    expect(h.text()).toMatch(/at least one row/i);
    for (let i = 0; i < 14; i += 1) await h.press("Add a row");
    expect(shape(h).rows).toBe(12);
    expect(h.text()).toMatch(/goes up to 12/i);
    h.unmount();
  });
});

describe("the array's scroll box can shrink to a phone", () => {
  /* Shares `SCROLL_BOX` with the number line and the times table, and shared
     the same defect: a flex item will not shrink below its content unless it
     is told it may, so a twelve-wide array pushed the page sideways instead of
     scrolling inside itself (§12 trap 16). */
  it("carries the classes that let it scroll rather than overflow", () => {
    const h = render("read_array", { rowRange: [10, 10], colRange: [12, 12] });
    const grid = h.screen.getByRole("img", { name: /^\d+ rows of \d+$/ });
    const box = grid.closest(".overflow-x-auto");
    expect(box, "the array has no scroll container").toBeTruthy();
    expect(box!.className).toContain("min-w-0");
    h.unmount();
  });
});

describe("turning an array cannot change how many squares it holds", () => {
  it("holds the count across a quarter turn, for every shape drawn", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "commute" }, i);
      expect(question.rows * question.cols).toBe(question.total);
      // A square array has nothing to notice when it is turned.
      expect(question.rows).not.toBe(question.cols);
    }
  });

  it("offers exactly one reason, and it is the one that says nothing changed", () => {
    for (let i = 0; i < 50; i += 1) {
      const question = buildQuestion({ mode: "commute" }, i);
      expect(question.reasons.filter((r) => r.correct)).toHaveLength(1);
      expect(question.reasons.find((r) => r.correct)!.text).toMatch(/^No/);
    }
  });
});

describe("both equations are one answer", () => {
  it("offers exactly two sentences that describe the array", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "array_to_equation" }, i);
      const right = question.equations.filter((e) => e.correct);
      expect(right).toHaveLength(2);
      // Both orders, and no third option that also totals the answer.
      expect(right.map((e) => e.text).sort()).toEqual(
        [`${question.rows} × ${question.cols} = ${question.total}`,
          `${question.cols} × ${question.rows} = ${question.total}`].sort(),
      );
      const totals = question.equations.map((e) => Number(/= (\d+)$/.exec(e.text)![1]));
      expect(totals.filter((t) => t === question.total)).toHaveLength(2);
    }
  });

  it("refuses a single sentence and scores nothing", async () => {
    const h = render("array_to_equation", { rowRange: [2, 3], colRange: [4, 5] });
    const { rows, cols } = shape(h);
    await h.press(`${rows} × ${cols} = ${rows * cols}`);
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "half an answer was scored").toBe(0);
    expect(h.text()).toMatch(/you have chosen 1/i);
    h.unmount();
  });

  it("judges the pair together, once", async () => {
    const h = render("array_to_equation", { rowRange: [2, 3], colRange: [4, 5] });
    const { rows, cols } = shape(h);
    await h.press(`${rows} × ${cols} = ${rows * cols}`);
    await h.press(`${rows} + ${cols} = ${rows + cols}`);
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(1);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    h.unmount();
  });
});

describe("a move that is not allowed is refused, not scored", () => {
  it("will not accept a total before the array is built", async () => {
    const h = render("build_array", { rowRange: [3, 3], colRange: [3, 3] });
    await h.press("9 squares");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/you need 3 rows of 3/i);
    h.unmount();
  });

  it("will not answer the turn question before turning", async () => {
    const h = render("commute", { rowRange: [2, 3], colRange: [4, 5] });
    await h.press("No — the same squares, just turned round.");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/turn the array before/i);
    h.unmount();
  });

  it("will not total a split before the array is cut", async () => {
    const h = render("split_array", { rowRange: [6, 6], colRange: [3, 3] });
    const { rows, cols } = shape(h);
    await h.press(`${rows * cols} squares`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/cut the array/i);
    h.unmount();
  });
});

describe("the split is always into pieces a child already knows", () => {
  it("cuts at a fact the foundational tables cover", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "split_array" }, i);
      expect(question.cuts.length).toBeGreaterThan(0);
      for (const cut of question.cuts) {
        expect(cut).toBeGreaterThan(0);
        expect(cut).toBeLessThan(question.rows);
      }
      // One of the two offered cuts is a two, five or ten.
      expect(question.cuts.some((cut) => [2, 5, 10].includes(cut))).toBe(true);
      // And the two pieces put the array back together.
      for (const cut of question.cuts) {
        expect(cut * question.cols + (question.rows - cut) * question.cols).toBe(question.total);
      }
    }
  });
});
