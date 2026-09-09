import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type AreaMode } from "./activities/AreaModel";
import { partialProductsOf, placeValueSplit } from "./internal/data/multiplicationNumbers";

/**
 * AreaModel, driven the way a child drives it.
 *
 * Every value placed here is worked out from the label on the piece it goes in
 * — "20 times 4" — and never read off the question. That matters more in this
 * engine than anywhere else in the skill: the pool deliberately contains each
 * answer with its digits shifted a place, so a driver that read the key would
 * skip the one decision the lesson is about.
 */

const area = skill.activities.area;

const ALL_MODES: AreaMode[] = ["rect_area", "area_2x1", "partial_products", "area_2x2"];

const render = (mode: AreaMode, params: Record<string, unknown> = {}) =>
  renderActivity(area, { params: { mode, questionsPerRound: 5, ...params } });

/** Every piece on screen, read off its own accessible name. */
const pieces = (h: ActivityHarness): { left: number; right: number; value: number | null }[] =>
  h.screen
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? "")
    .map((label) => /^(\d+) times (\d+), (empty|holding (\d+))$/.exec(label))
    .filter(Boolean)
    .map((m) => ({
      left: Number(m![1]),
      right: Number(m![2]),
      value: m![4] === undefined ? null : Number(m![4]),
    }));

/** Fill every piece from its own edge labels. */
async function fillFromLabels(h: ActivityHarness): Promise<void> {
  for (let guard = 0; guard < 8; guard += 1) {
    const empty = pieces(h).find((p) => p.value === null);
    if (!empty) break;
    // Select the piece, then put in the product of the two numbers on it.
    await h.press(`${empty.left} times ${empty.right}, empty`);
    await h.press(`Put ${empty.left * empty.right} in`);
  }
}

const drivers: Record<AreaMode, (h: ActivityHarness) => Promise<void>> = {
  rect_area: async (h) => {
    const [, a, b] = /A rectangle (\d+) across and (\d+) down/.exec(h.text())!;
    await h.press(`${Number(a) * Number(b)} squares`);
  },
  area_2x1: async (h) => {
    await fillFromLabels(h);
    await h.press("Check");
  },
  partial_products: async (h) => {
    await fillFromLabels(h);
    await h.press("Check");
  },
  area_2x2: async (h) => {
    await fillFromLabels(h);
    await h.press("Check");
  },
};

describe("every area mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(area, drivers[mode], { params: { mode }, questions: 5 });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The pieces themselves                                                       */
/* -------------------------------------------------------------------------- */

describe("the rectangle is cut at its place values, and the cuts add up", () => {
  it("splits both sides and reconstructs the product exactly", () => {
    for (const mode of ["area_2x1", "partial_products", "area_2x2"] as AreaMode[]) {
      for (let i = 0; i < 150; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.leftParts).toEqual(placeValueSplit(question.a));
        expect(question.rightParts).toEqual(placeValueSplit(question.b));
        expect(question.parts).toEqual(partialProductsOf(question.a, question.b));
        // The whole claim of an area model, checked arithmetically.
        const sum = question.parts.reduce((t, p) => t + p.product, 0);
        expect(sum).toBe(question.product);
        for (const part of question.parts) {
          expect(part.product).toBe(part.left * part.right);
        }
      }
    }
  });

  it("gives a two-by-two model four pieces, none of them zero", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "area_2x2" }, i);
      expect(question.parts).toHaveLength(4);
      // A zero digit collapses the model to two pieces and hides the structure
      // the lesson exists to show, while still scoring the answer correct.
      for (const part of question.parts) expect(part.product).toBeGreaterThan(0);
      expect(String(question.a)).not.toContain("0");
      expect(String(question.b)).not.toContain("0");
    }
  });

  it("lets one value fill two pieces when two pieces need it", async () => {
    // 12 × 12: 10×2 and 2×10 are both twenty.
    const h = render("area_2x2", {});
    const board = pieces(h);
    const twins = board.filter((p) => board.some((q) => q !== p && p.left * p.right === q.left * q.right));
    if (twins.length < 2) {
      h.unmount();
      return;
    }
    for (const piece of twins) {
      await h.press(`${piece.left} times ${piece.right}, empty`);
      await h.press(`Put ${piece.left * piece.right} in`);
    }
    const after = pieces(h);
    for (const piece of twins) {
      expect(after.find((p) => p.left === piece.left && p.right === piece.right)!.value)
        .toBe(piece.left * piece.right);
    }
    h.unmount();
  });

  it("gives a two-by-one model exactly two", () => {
    for (let i = 0; i < 150; i += 1) {
      const question = buildQuestion({ mode: "area_2x1" }, i);
      expect(question.parts).toHaveLength(2);
      expect(question.rightParts).toHaveLength(1);
    }
  });

  it("labels every piece on screen with the two numbers that make it", async () => {
    const h = render("area_2x2");
    const onScreen = pieces(h);
    expect(onScreen).toHaveLength(4);
    for (const piece of onScreen) {
      // §12 trap 10: a piece with no label is a piece drawn to a lie.
      expect(h.text()).toContain(`${piece.left} × ${piece.right}`);
    }
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* §12 trap 11                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The engine must place the part, not just accept the number.
 *
 * `20 × 40` is eight hundred; writing eighty is the error of this level. The
 * pool offers both, so the child has to decide where the digits sit rather
 * than only what they are.
 */
describe("a partial product has to go in the right place", () => {
  it("offers every answer alongside the same digits a place out", () => {
    for (const mode of ["area_2x1", "area_2x2"] as AreaMode[]) {
      for (let i = 0; i < 150; i += 1) {
        const question = buildQuestion({ mode }, i);
        for (const part of question.parts) expect(question.pool).toContain(part.product);
        // At least one option is a place-value slip on a real answer.
        const slips = question.pool.filter(
          (n) => !question.parts.some((p) => p.product === n)
            && question.parts.some((p) => p.product === n * 10 || p.product === n / 10),
        );
        expect(slips.length, `${question.a} × ${question.b} offered no place-value slip`).toBeGreaterThan(0);
        /*
         * One button per value.
         *
         * `12 × 12` has two pieces worth twenty, and listing the products
         * straight put twenty on the board twice — two buttons that do the
         * same thing, and two React children with the same key. Placing does
         * not consume, so one of each is right.
         */
        expect(new Set(question.pool).size).toBe(question.pool.length);
      }
    }
  });

  it("marks a piece filled with the right digits in the wrong place wrong", async () => {
    const h = render("area_2x2");
    const target = pieces(h)[0];
    const slip = target.left * target.right * 10;
    // Only run where the slip is actually on offer; the pool is built from
    // whichever slips are free, so it is not always the tenfold one.
    if (!h.buttons().includes(`Put ${slip} in`)) {
      h.unmount();
      return;
    }
    await h.press(`${target.left} times ${target.right}, empty`);
    await h.press(`Put ${slip} in`);
    for (let guard = 0; guard < 6; guard += 1) {
      const empty = pieces(h).find((p) => p.value === null);
      if (!empty) break;
      await h.press(`${empty.left} times ${empty.right}, empty`);
      await h.press(`Put ${empty.left * empty.right} in`);
    }
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    // And it says which piece, and what belonged there.
    expect(h.text()).toMatch(new RegExp(`${target.left} × ${target.right} is ${target.left * target.right}, not ${slip}`));
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Filling and refusing                                                        */
/* -------------------------------------------------------------------------- */

describe("filling the pieces", () => {
  it("refuses a check while any piece is empty, and scores nothing", async () => {
    const h = render("area_2x1");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/still empty/i);

    const first = pieces(h)[0];
    await h.press(`${first.left} times ${first.right}, empty`);
    await h.press(`Put ${first.left * first.right} in`);
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "one piece of two was accepted").toBe(0);
    h.unmount();
  });

  it("lets a piece be emptied and filled again", async () => {
    const h = render("area_2x1");
    const first = pieces(h)[0];
    await h.press(`${first.left} times ${first.right}, empty`);
    await h.press(`Put ${first.left * first.right} in`);
    expect(pieces(h).find((p) => p.left === first.left)!.value).toBe(first.left * first.right);
    // Tapping a filled piece clears it, so a change of mind is one tap.
    await h.press(`${first.left} times ${first.right}, holding ${first.left * first.right}`);
    expect(pieces(h).find((p) => p.left === first.left)!.value).toBeNull();
    h.unmount();
  });

  it("scores the total the pieces add up to", async () => {
    const h = render("area_2x1");
    const [, a, b] = /(\d+) × (\d+)\. Fill in each piece/.exec(h.text())!;
    await fillFromLabels(h);
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean; given?: string });
    expect(report.correct).toBe(true);
    expect(report.given).toBe(String(Number(a) * Number(b)));
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Reading an area                                                             */
/* -------------------------------------------------------------------------- */

describe("area starts concrete and stops being concrete", () => {
  it("shows the unit squares while the idea is new, and drops them after", () => {
    // Two questions of squares to count, then the side labels alone.
    expect(buildQuestion({ mode: "rect_area" }, 0).showUnits).toBe(true);
    expect(buildQuestion({ mode: "rect_area" }, 1).showUnits).toBe(true);
    expect(buildQuestion({ mode: "rect_area" }, 2).showUnits).toBe(false);
    expect(buildQuestion({ mode: "rect_area", unitsUntil: 0 }, 0).showUnits).toBe(false);
  });

  it("draws the rectangle either way, and answers from its sides", async () => {
    const h = render("rect_area", { sideRange: [4, 4] });
    expect(h.screen.getByRole("img", { name: "A rectangle 4 across and 4 down" })).toBeTruthy();
    await h.press("16 squares");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(true);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet carries the model, because without it the task changes", () => {
  it("prints every mode, with a figure everywhere the picture is the task", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = area.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.answer).toContain(String(question.product));
        expect(area.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // §9: the area figure is essential; the written column is not a picture.
        expect(Boolean(area.worksheet!.figure!(question))).toBe(mode !== "partial_products");
      }
    }
  });
});
