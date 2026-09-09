import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type TableMode } from "./activities/TableGrid";
import {
  MAX_MATCHES,
  MIN_MATCHES,
  PATTERN_RULES,
  drawPatternHunt,
  matchesIn,
  ruleById,
} from "./internal/data/tablePatterns";

/**
 * TableGrid, driven the way a child drives it.
 *
 * Every cell this presses is worked out from the prompt's own numbers, never
 * from `question.expected`. The chart is symmetric and full of the right
 * answer, so a driver that read the key would prove nothing at all here.
 */

const table = skill.activities.table;

const ALL_MODES: TableMode[] = ["find_cell", "pattern_hunt", "squares", "commutative_pairs"];

const render = (mode: TableMode, params: Record<string, unknown> = {}) =>
  renderActivity(table, { params: { mode, questionsPerRound: 5, ...params } });

const drivers: Record<TableMode, (h: ActivityHarness) => Promise<void>> = {
  find_cell: async (h) => {
    const [, a, b] = /Find (\d+) × (\d+)\./.exec(h.text())!;
    await h.press(`${a} times ${b}`);
  },
  squares: async (h) => {
    const [, n] = /(\d+) × \d+\. Find the square/.exec(h.text())!;
    await h.press(`${n} times ${n}`);
  },
  commutative_pairs: async (h) => {
    const [, a, b] = /(\d+) × (\d+) is shaded/.exec(h.text())!;
    // The twin is the same two numbers the other way round — worked out here.
    await h.press(`${b} times ${a}`);
  },
  pattern_hunt: async (h) => {
    const [, row, asks] = /In the (\d+) times row, tap every answer that ([^.]+)\./.exec(h.text())!;
    const driver = Number(row);
    const rule = PATTERN_RULES.find((r) => r.asks === asks)!;
    const ceiling = Number(
      /Times table up to (\d+)/.exec(
        h.screen.getByRole("grid").getAttribute("aria-label") ?? "",
      )![1],
    );
    // The set is computed from the rule, not read off the question.
    for (let partner = 1; partner <= ceiling; partner += 1) {
      if (rule.holds(driver * partner)) await h.press(`${driver} times ${partner}`);
    }
    await h.press("Check");
  },
};

describe("every table mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(table, drivers[mode], { params: { mode }, questions: 5 });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The chart                                                                   */
/* -------------------------------------------------------------------------- */

describe("the chart is the apparatus, and it fits a phone by scrolling", () => {
  it("renders every cell as a reachable, named button", async () => {
    const h = render("find_cell", { ceiling: 12 });
    const grid = h.screen.getByRole("grid", { name: "Times table up to 12" });
    expect(grid.querySelectorAll("button")).toHaveLength(144);
    expect(h.buttons()).toContain("7 times 8");
    // §12 trap 16: the apparatus scrolls inside its own box, not the page.
    expect(grid.closest(".overflow-x-auto"), "the chart has no scroll container").toBeTruthy();
    h.unmount();
  });

  /**
   * §12 trap 16, and the reason it was not already covered.
   *
   * Every wide apparatus in this skill is a flex item, and a flex item defaults
   * to `min-width: auto` — it will not shrink below its content. Measured in
   * the running app, a 620px times table sat at full width inside a 360px
   * parent and pushed the page sideways; `overflow-x-auto` never engaged
   * because nothing ever overflowed. jsdom does no layout, so this asserts the
   * contract that makes the scrolling possible rather than the pixels.
   */
  it("gives the chart a scroll box that can actually shrink", async () => {
    const h = render("find_cell");
    const box = h.screen.getByRole("grid").closest(".overflow-x-auto");
    expect(box, "the chart has no scroll container").toBeTruthy();
    expect(box!.className).toContain("min-w-0");
    expect(box!.className).toContain("max-w-full");
    h.unmount();
  });

  it("shrinks to a ten by ten chart, and stops drawing elevens and twelves", async () => {
    const h = render("find_cell", { ceiling: 10 });
    const grid = h.screen.getByRole("grid", { name: "Times table up to 10" });
    expect(grid.querySelectorAll("button")).toHaveLength(100);
    expect(h.buttons()).not.toContain("11 times 2");
    h.unmount();
  });

  it("draws no fact past the ceiling it was given", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 80; i += 1) {
        const question = buildQuestion({ mode, ceiling: 10 }, i);
        expect(question.a).toBeLessThanOrEqual(10);
        expect(question.b).toBeLessThanOrEqual(10);
        for (const partner of question.matches) expect(partner).toBeLessThanOrEqual(10);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Finding a cell                                                              */
/* -------------------------------------------------------------------------- */

describe("finding a cell traces a row and a column", () => {
  it("accepts either cell that holds the product, because the chart really is symmetric", async () => {
    const h = render("find_cell");
    const [, a, b] = /Find (\d+) × (\d+)\./.exec(h.text())!;
    await h.press(`${b} times ${a}`);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct, "the transposed cell holds the same answer").toBe(true);
    h.unmount();
  });

  it("marks a cell that holds a different number wrong", async () => {
    const h = render("find_cell");
    const [, a, b] = /Find (\d+) × (\d+)\./.exec(h.text())!;
    const wrong = Number(a) === 2 ? 3 : 2;
    // A cell whose own product differs from the one asked for.
    if (wrong * Number(b) === Number(a) * Number(b)) {
      h.unmount();
      return;
    }
    await h.press(`${wrong} times ${b}`);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    h.unmount();
  });

  it("never asks for a cell on the diagonal, where there is no row to trace", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "find_cell" }, i);
      expect(question.a).not.toBe(question.b);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Pattern hunting                                                             */
/* -------------------------------------------------------------------------- */

describe("a pattern hunt is only a hunt if the answer is a proper subset", () => {
  it("never draws a rule that matches the whole row, or almost none of it", () => {
    for (const ceiling of [10, 12]) {
      for (let i = 0; i < 300; i += 1) {
        const hunt = drawPatternHunt(ceiling);
        expect(hunt.matches).toEqual(matchesIn(hunt.driver, hunt.rule, ceiling));
        expect(hunt.matches.length).toBeGreaterThanOrEqual(MIN_MATCHES);
        expect(hunt.matches.length).toBeLessThanOrEqual(MAX_MATCHES);
        // "Tap every even answer in the twos" is every cell: a true observation
        // and a pointless selection.
        expect(hunt.matches.length).toBeLessThan(ceiling);
      }
    }
  });

  it("throws rather than relax when no rule fits the rows asked for", () => {
    // The twos: every answer is even, none ends in 5, and only some end in 0 —
    // 2 x 5 and 2 x 10, which is a legal hunt. The tens are the degenerate row.
    expect(() => drawPatternHunt(10, [10])).toThrow(/no pattern hunt fits/);
  });

  it("checks the whole selection once, not cell by cell", async () => {
    const h = render("pattern_hunt");
    const [, row] = /In the (\d+) times row/.exec(h.text())!;
    await h.press(`${row} times 1`);
    await h.press(`${row} times 2`);
    expect(h.koda.count("learning.answered"), "a cell was scored on its own").toBe(0);
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("refuses a cell outside the row, and scores nothing", async () => {
    const h = render("pattern_hunt");
    const [, row] = /In the (\d+) times row/.exec(h.text())!;
    const other = Number(row) === 3 ? 4 : 3;
    await h.press(`${other} times 5`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/that cell is in row/i);
    h.unmount();
  });

  it("refuses an empty check", async () => {
    const h = render("pattern_hunt");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/tap the answers that fit/i);
    h.unmount();
  });

  /*
   * The pattern gets said whether the child was right or not.
   *
   * The point of level 21 is the pattern, and a round that only speaks when the
   * selection is complete has taught tapping.
   */
  it("names the row's pattern on a wrong selection too", async () => {
    const h = render("pattern_hunt", { drivers: [5] });
    const [, row] = /In the (\d+) times row/.exec(h.text())!;
    expect(row).toBe("5");
    await h.press("5 times 1");
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    // One cell is never the whole set for a legal hunt.
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(/Every answer in the fives ends in 0 or 5/);
    h.unmount();
  });

  it("keeps every rule honest about the products it claims", () => {
    for (const rule of PATTERN_RULES) {
      expect(ruleById(rule.id)).toBe(rule);
      for (let n = 1; n <= 144; n += 1) {
        const expected =
          rule.id === "ends_in_zero" ? n % 10 === 0
            : rule.id === "ends_in_five" ? n % 10 === 5
              : rule.id === "is_even" ? n % 2 === 0
                : n % 2 === 1;
        expect(rule.holds(n), `${rule.id} disagrees about ${n}`).toBe(expected);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Squares and pairs                                                           */
/* -------------------------------------------------------------------------- */

describe("squares sit on the diagonal, and are drawn as squares", () => {
  it("always multiplies a number by itself", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "squares" }, i);
      expect(question.a).toBe(question.b);
      expect(question.product).toBe(question.a * question.a);
      expect(question.a).toBeGreaterThanOrEqual(2);
    }
  });

  it("draws a true square beside the chart", async () => {
    const h = render("squares");
    const [, n] = /(\d+) × \d+\. Find the square/.exec(h.text())!;
    expect(h.screen.getByRole("img", { name: `${n} rows of ${n}` })).toBeTruthy();
    h.unmount();
  });

  it("prints the square as a figure on paper", () => {
    const question = buildQuestion({ mode: "squares" }, 0);
    expect(table.worksheet!.figure!(question)).toBeTruthy();
    expect(table.worksheet!.printed!(question)!.answer).toBe(String(question.product));
  });
});

describe("every fact appears twice", () => {
  it("never shades a square, which has no twin to find", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "commutative_pairs" }, i);
      expect(question.a).not.toBe(question.b);
    }
  });

  it("refuses the shaded cell itself rather than marking it wrong", async () => {
    const h = render("commutative_pairs");
    const [, a, b] = /(\d+) × (\d+) is shaded/.exec(h.text())!;
    await h.press(`${a} times ${b}`);
    expect(h.koda.count("learning.answered"), "the given cell was scored").toBe(0);
    expect(h.text()).toMatch(/already shaded/i);
    h.unmount();
  });

  it("marks a cell that is not the twin wrong", async () => {
    const h = render("commutative_pairs");
    const [, a, b] = /(\d+) × (\d+) is shaded/.exec(h.text())!;
    const other = Number(b) === 12 ? 11 : Number(b) + 1;
    await h.press(`${other} times ${a}`);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    h.unmount();
  });
});

describe("practice runs the same chart with nothing to lean on", () => {
  it("says nothing, offers no read-aloud, and keeps the chart it works on", async () => {
    const h = renderActivity(table, {
      params: { practice: true, modes: ["find_cell", "squares"], questionsPerRound: 4 },
    });
    expect(h.buttons()).not.toContain("Read question aloud");
    
    // The apparatus stays: a times table round without the table is not a round.
    expect(h.screen.getByRole("grid", { name: /^Times table up to \d+$/ })).toBeTruthy();
    const [, a, b] = /Find (\d+) × (\d+)\./.exec(h.text())!;
    await h.press(`${a} times ${b}`);
    expect(h.koda.count("speech.say"), "practice spoke").toBe(0);
    h.unmount();
  });

  it("cycles the modes it was given rather than sampling them", () => {
    const modes = ["find_cell", "squares", "commutative_pairs"];
    for (let i = 0; i < 9; i += 1) {
      const question = buildQuestion({ practice: true, modes }, i);
      expect(question.mode).toBe(modes[i % modes.length]);
    }
  });

  /*
   * The same cycling, through the round rather than through `buildQuestion`.
   *
   * `useSkillRound` numbers its questions from one and the worksheet builder
   * numbers them from zero, and every engine in this skill was handing the
   * hook's number straight to a builder that expected the other. Nothing
   * failed: the cycle still covered every mode, just rotated by one, so a
   * practice round quietly opened on its second technique. Only a test that
   * goes through the component can see it.
   */
  it("opens a practice round on the first mode, not the second", async () => {
    const h = renderActivity(table, {
      params: { practice: true, modes: ["squares", "find_cell"], questionsPerRound: 4 },
    });
    expect(h.text()).toMatch(/Find the square on the diagonal/);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints what paper can carry", () => {
  it("prints three modes and honestly declines the fourth", () => {
    for (const mode of ALL_MODES) {
      const question = buildQuestion({ mode }, 0);
      const printed = table.worksheet!.printed!(question);
      if (mode === "pattern_hunt") {
        // A hunt is a selection across a chart the sheet does not carry, and
        // rewriting it as "list them" would be different arithmetic (§9).
        expect(printed).toBeNull();
        expect(table.worksheet!.method!(question)).toBeNull();
        continue;
      }
      expect(printed, `${mode} prints nothing`).toBeTruthy();
      expect(printed!.text).toContain(String(question.a));
      expect(printed!.answer).toContain(String(question.product));
      expect(table.worksheet!.method!(question)!.length).toBeGreaterThan(1);
    }
  });
});
