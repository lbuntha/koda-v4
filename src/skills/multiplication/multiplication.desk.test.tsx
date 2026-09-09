import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type DeskMode } from "./activities/PlaceValueDesk";
import { PLACE_NAMES, drawScaledProduct } from "./internal/data/multiplicationNumbers";

/**
 * PlaceValueDesk, driven the way a child drives it.
 *
 * The thing under test is not really the arithmetic — `3 × 40` is not hard —
 * it is whether the desk teaches *where the zero comes from*. So most of what
 * follows is about the words and the columns rather than the totals.
 */

const chart = skill.activities.chart;

const ALL_MODES: DeskMode[] = ["times_ten_hundred", "multiples_of_ten", "tens_times_tens"];

const render = (mode: DeskMode, params: Record<string, unknown> = {}) =>
  renderActivity(chart, { params: { mode, questionsPerRound: 5, ...params } });

/** What the desk currently reads, off its own description. */
const deskReads = (h: ActivityHarness): number | null => {
  const label = h.screen
    .getAllByRole("img")
    .map((el) => el.getAttribute("aria-label") ?? "")
    .find((text) => /^The desk (reads \d+|is empty)$/.test(text));
  expect(label, "no desk on screen").toBeTruthy();
  const match = /reads (\d+)/.exec(label!);
  return match ? Number(match[1]) : null;
};

const drivers: Record<DeskMode, (h: ActivityHarness) => Promise<void>> = {
  times_ten_hundred: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. Move the digits/.exec(h.text())!;
    // How far to move is worked out from the multiplier, not read back.
    const places = Number(b) === 100 ? 2 : 1;
    for (let i = 0; i < places; i += 1) await h.press("Move the digits one place left");
    expect(deskReads(h)).toBe(Number(a) * Number(b));
    await h.press("Check");
  },
  multiples_of_ten: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. How many tens/.exec(h.text())!;
    await h.press(`${(Number(a) * Number(b)) / 10} of them`);
    await h.press("tens");
    await h.press("Check");
  },
  tens_times_tens: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. How many, and of what/.exec(h.text())!;
    await h.press(`${(Number(a) / 10) * (Number(b) / 10)} of them`);
    await h.press("hundreds");
    await h.press("Check");
  },
};

describe("every desk mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(chart, drivers[mode], { params: { mode }, questions: 5 });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* §12 trap 5                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The most installed false rule in this topic, and the one this engine exists
 * to avoid. It is checked in every place a child could read it: the prompt, the
 * feedback, the hints and the printed method.
 */
describe("nothing here ever tells a child to add a zero", () => {
  const forbidden = /add a zero|adds a zero|put a zero|write a zero on|stick a zero|add zeroes|add two zeros/i;

  it("keeps the rule out of every word the engine can say", async () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 30; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.prompt, `${mode} prompt`).not.toMatch(forbidden);
        expect(chart.worksheet!.printed!(question)!.text).not.toMatch(forbidden);
        expect(chart.worksheet!.printed!(question)!.answer).not.toMatch(forbidden);
        expect(chart.worksheet!.method!(question)!.join(" "), `${mode} method`).not.toMatch(forbidden);
      }
    }
  });

  it("says the zero arrived because a column emptied", async () => {
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [10] });
    await h.press("Move the digits one place left");
    await h.press("Check");
    expect(h.text()).toMatch(/the ones column was left empty — that is where the zero comes from/i);
    expect(h.text()).not.toMatch(forbidden);
    h.unmount();
  });

  it("never scales a number that already ends in zero", () => {
    // The zero a child is meant to watch arrive would already be sitting there.
    for (let i = 0; i < 300; i += 1) {
      const drawn = drawScaledProduct("times_ten_hundred", { valueRange: [2, 99] });
      expect(drawn.a % 10).not.toBe(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Moving the digits                                                           */
/* -------------------------------------------------------------------------- */

describe("the digits move, one column at a time", () => {
  it("multiplies by ten for each column moved", async () => {
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [100] });
    expect(deskReads(h)).toBe(34);
    await h.press("Move the digits one place left");
    expect(deskReads(h)).toBe(340);
    await h.press("Move the digits one place left");
    expect(deskReads(h)).toBe(3400);
    await h.press("Move the digits back to the right");
    expect(deskReads(h)).toBe(340);
    h.unmount();
  });

  it("refuses to move back past the start, or off the end of the desk", async () => {
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [100] });
    await h.press("Move the digits back to the right");
    expect(deskReads(h)).toBe(34);
    expect(h.text()).toMatch(/back where they started/i);
    // 34 → 340 → 3400 fills the desk; a fourth column would fall off it.
    for (let i = 0; i < 4; i += 1) await h.press("Move the digits one place left");
    expect(deskReads(h)).toBe(3400);
    expect(h.text()).toMatch(/no room to move them any further/i);
    expect(h.koda.count("learning.answered"), "a refused move was scored").toBe(0);
    h.unmount();
  });

  /*
   * Thousands and tens both begin with a T.
   *
   * The headings were taken from the first letter of each place name, so the
   * desk read "T H T O" — on a chart whose entire purpose is telling one
   * column from the next. Spotted by looking at it.
   */
  it("gives every column a heading that tells it apart from the others", async () => {
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [100] });
    const headings = [...h.screen.getByRole("img", { name: /^The desk / }).querySelectorAll("span")]
      .map((el) => el.textContent)
      .filter((t) => t && /^[A-Za-z]+$/.test(t));
    expect(headings).toEqual(["Th", "H", "T", "O"]);
    expect(new Set(headings).size, "two columns share a heading").toBe(4);
    h.unmount();
  });

  it("refuses a check before anything has moved", async () => {
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [10] });
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/move the digits first/i);
    h.unmount();
  });

  it("marks a run of the wrong length wrong, rather than refusing it", async () => {
    // Moving two places for a ×10 is the error the level is about, so it has
    // to be answerable — and wrong.
    const h = render("times_ten_hundred", { valueRange: [34, 34], scales: [10] });
    await h.press("Move the digits one place left");
    await h.press("Move the digits one place left");
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean; given?: string });
    expect(report.correct).toBe(false);
    expect(report.given).toBe("3400");
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* How many, and of what                                                       */
/* -------------------------------------------------------------------------- */

describe("the count and the column are both the answer", () => {
  it("reads the product as a count of a place", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 200; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.count * question.place).toBe(question.product);
        expect(question.product).toBe(question.a * question.b);
        expect(PLACE_NAMES[question.place]).toBeTruthy();
      }
    }
  });

  it("puts the answer in hundreds for tens times tens, and tens for the other", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(buildQuestion({ mode: "tens_times_tens" }, i).place).toBe(100);
      expect(buildQuestion({ mode: "multiples_of_ten" }, i).place).toBe(10);
    }
  });

  /*
   * Choosing tens for `30 × 40` is the whole error the level is named for, so
   * the board has to let a child make it — and then be wrong.
   */
  it("offers the wrong column, and marks it wrong", async () => {
    const h = render("tens_times_tens", { digitRange: [3, 3] });
    const [, a, b] = /(\d+) × (\d+)\. How many, and of what/.exec(h.text())!;
    expect([Number(a), Number(b)]).toEqual([30, 30]);
    expect(h.buttons()).toContain("tens");
    await h.press("9 of them");
    await h.press("tens");
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean; given?: string });
    expect(report.correct).toBe(false);
    expect(report.given).toBe("90");
    expect(h.text()).toMatch(/9 hundreds, which is 900/);
    h.unmount();
  });

  it("refuses a check with only half an answer", async () => {
    const h = render("multiples_of_ten", { digitRange: [3, 4] });
    await h.press("Check");
    expect(h.text()).toMatch(/choose how many first/i);
    expect(h.koda.count("learning.answered")).toBe(0);

    const first = h.buttons().find((l) => /^\d+ of them$/.test(l))!;
    await h.press(first);
    await h.press("Check");
    expect(h.text()).toMatch(/choose which column/i);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("shows the desk filling in as the two choices are made", async () => {
    const h = render("multiples_of_ten", { digitRange: [3, 4] });
    // Both digits are drawn from the range, so the count is 9, 12 or 16 — read
    // it off the prompt rather than assuming which pair came up.
    const [, a, b] = /(\d+) × (\d+)\. How many tens/.exec(h.text())!;
    const count = (Number(a) * Number(b)) / 10;
    expect(deskReads(h)).toBeNull();
    await h.press(`${count} of them`);
    // Still nothing on the desk: a count without a place is not a number.
    expect(deskReads(h)).toBeNull();
    await h.press("tens");
    expect(deskReads(h)).toBe(count * 10);
    h.unmount();
  });

  it("never offers the answer nudged by one", () => {
    for (const mode of ["multiples_of_ten", "tens_times_tens"] as DeskMode[]) {
      for (let i = 0; i < 200; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.counts).toContain(question.count);
        expect(new Set(question.counts).size).toBe(4);
        for (const n of question.counts) {
          expect(n).toBeGreaterThan(0);
          if (n !== question.count) expect(Math.abs(n - question.count)).not.toBe(1);
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints all three modes", () => {
  it("prints the question, the answer, and an empty chart to fill in", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = chart.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text).toContain(`${question.a} × ${question.b}`);
        expect(printed!.answer).toContain(String(question.product));
        expect(chart.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // The columns are the apparatus, so paper gets them too.
        expect(chart.worksheet!.figure!(question)).toBeTruthy();
      }
    }
  });
});
