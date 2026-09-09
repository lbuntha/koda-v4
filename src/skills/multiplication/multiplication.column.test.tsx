import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type ColumnMode } from "./activities/ColumnPad";
import { carriesIn, columnSteps, digitProducts, placeValueSplit } from "./internal/data/multiplicationNumbers";

/**
 * ColumnPad, driven the way a child drives it.
 *
 * The written method is the one place in this skill where a child can reach the
 * right total by a wrong route, so nothing here checks only the answer: the
 * carries are checked, the rows are checked, and the second row has to be
 * named before it can be written.
 */

const column = skill.activities.column;

const ALL_MODES: ColumnMode[] = ["no_regroup", "regroup", "two_digit"];

const render = (mode: ColumnMode, params: Record<string, unknown> = {}) =>
  renderActivity(column, { params: { mode, questionsPerRound: 5, ...params } });

/** The column as it stands, read off the cells' own names. */
const cells = (h: ActivityHarness): { name: string; value: number | null }[] =>
  h.screen
    .getAllByLabelText(/^(The |Carry into the )/)
    .map((el) => {
      const label = el.getAttribute("aria-label")!;
      const m = /, (empty|(\d+))$/.exec(label);
      return { name: label.replace(/, (empty|\d+)$/, ""), value: m?.[2] === undefined ? null : Number(m[2]) };
    });

/**
 * Work the method by hand and type it in.
 *
 * The steps are recomputed here from the two factors rather than read off the
 * question, so a wrong answer key would fail rather than be confirmed.
 */
async function writeTheColumn(h: ActivityHarness, a: number, b: number): Promise<void> {
  for (const step of columnSteps(a, b)) await h.press(`Digit ${step.value}`);
}

const drivers: Record<ColumnMode, (h: ActivityHarness) => Promise<void>> = {
  no_regroup: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. Start with the ones/.exec(h.text())!;
    await writeTheColumn(h, Number(a), Number(b));
    await h.press("Check");
  },
  regroup: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. Work right to left/.exec(h.text())!;
    await writeTheColumn(h, Number(a), Number(b));
    await h.press("Check");
  },
  two_digit: async (h) => {
    const [, a, b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const [ones, tens] = placeValueSplit(Number(b)).slice().reverse();
    await h.press(`The second row multiplies by ${tens}`);
    // Each row is aimed at before it is typed into, the way a child does it.
    const rows: [string, number][] = [
      [`${a} × ${ones}`, Number(a) * ones],
      [`${a} × ${tens}`, Number(a) * tens],
      ["Total", Number(a) * Number(b)],
    ];
    for (const [label, value] of rows) {
      await h.press(`${label}, empty`);
      for (const digit of String(value)) await h.press(`Digit ${digit}`);
    }
    await h.press("Check");
  },
};

describe("every column mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(column, drivers[mode], {
        params: { mode },
        questions: mode === "two_digit" ? 4 : 5,
      });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The method itself                                                           */
/* -------------------------------------------------------------------------- */

describe("the steps are the written method, in writing order", () => {
  it("reconstructs the product from the digits it asks for", () => {
    for (const [a, b] of [[23, 3], [47, 3], [99, 9], [246, 7], [58, 6]] as [number, number][]) {
      const steps = columnSteps(a, b);
      const value = steps
        .filter((s) => s.kind === "digit")
        .reduce((sum, s) => sum + s.value * s.place, 0);
      expect(value, `${a} × ${b}`).toBe(a * b);
      // Every digit written is a single digit.
      for (const step of steps) expect(step.value).toBeLessThan(10);
    }
  });

  /*
   * The final carry is not a carry.
   *
   * `47 × 3` ends by writing 1 in the hundreds — a digit of the answer, not
   * something carried into a column that does not exist. A carry box there
   * would be teaching a step that is not part of the method.
   */
  it("never offers a carry box past the last column", () => {
    for (let a = 11; a <= 99; a += 1) {
      for (let b = 2; b <= 9; b += 1) {
        const steps = columnSteps(a, b);
        const widest = Math.max(...steps.filter((s) => s.kind === "digit").map((s) => s.place));
        for (const step of steps) {
          if (step.kind === "carry") expect(step.place).toBeLessThanOrEqual(widest);
        }
      }
    }
  });

  it("gives level 45 nothing to carry and level 46 something", () => {
    for (let i = 0; i < 150; i += 1) {
      const easy = buildQuestion({ mode: "no_regroup" }, i);
      expect(digitProducts(easy.a, easy.b).every((n) => n <= 9), `${easy.a} × ${easy.b}`).toBe(true);
      expect(easy.steps.some((s) => s.kind === "carry")).toBe(false);

      const hard = buildQuestion({ mode: "regroup" }, i);
      expect(carriesIn(hard.a, hard.b)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("writing the column", () => {
  it("fills right to left, and rubs out the last thing written", async () => {
    const h = render("no_regroup");
    const [, a, b] = /(\d+) × (\d+)\. Start with the ones/.exec(h.text())!;
    const steps = columnSteps(Number(a), Number(b));
    await h.press(`Digit ${steps[0].value}`);
    expect(cells(h).find((c) => c.name === "The ones")!.value).toBe(steps[0].value);
    await h.press("Delete");
    expect(cells(h).find((c) => c.name === "The ones")!.value).toBeNull();
    h.unmount();
  });

  it("refuses a check while columns are unwritten, and scores nothing", async () => {
    const h = render("no_regroup");
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/more to write/i);
    h.unmount();
  });

  /*
   * A right total by a wrong route is still wrong.
   *
   * The carries are part of the method, so they are checked as digits are, and
   * the feedback names the column rather than only the total.
   */
  it("names the column that went wrong", async () => {
    const h = render("regroup");
    const [, a, b] = /(\d+) × (\d+)\. Work right to left/.exec(h.text())!;
    const steps = columnSteps(Number(a), Number(b));
    for (const [i, step] of steps.entries()) {
      // Spoil exactly one entry.
      await h.press(`Digit ${i === 0 ? (step.value + 1) % 10 : step.value}`);
    }
    await h.press("Check");
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(new RegExp(`ones column should be ${steps[0].value}`));
    h.unmount();
  });

  it("gives the carry its own box, above the column it goes into", async () => {
    const h = render("regroup", { digitsA: 2 });
    const [, a, b] = /(\d+) × (\d+)\. Work right to left/.exec(h.text())!;
    const carry = columnSteps(Number(a), Number(b)).find((s) => s.kind === "carry");
    if (!carry) {
      h.unmount();
      return;
    }
    const names = cells(h).map((c) => c.name);
    expect(names).toContain(carry.place === 10 ? "Carry into the tens" : "Carry into the hundreds");
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* §12 trap 12                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The placeholder zero taught as a keystroke.
 *
 * `46 × 23` has a second row of `46 × 20`. A child who thinks it is `46 × 2`
 * with a zero written afterwards cannot explain the method the moment it grows
 * a third row, so the engine asks before it lets them write.
 */
describe("the second row multiplies by the tens, not by the digit", () => {
  it("offers the bare digit and refuses it with a reason", async () => {
    const h = render("two_digit");
    const [, a, b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const tens = placeValueSplit(Number(b))[0];
    const digit = tens / 10;
    expect(h.buttons()).toContain(`The second row multiplies by ${digit}`);
    await h.press(`The second row multiplies by ${digit}`);
    expect(h.koda.count("learning.answered"), "a route was scored as an answer").toBe(0);
    expect(h.text()).toMatch(
      new RegExp(`The ${digit} in ${b} is worth ${tens}, not ${digit}`),
    );
    expect(h.text()).toMatch(/that is where its zero comes from/i);
    h.unmount();
  });

  /*
   * The pad is not on screen while the question is which multiplier to use.
   *
   * Every key would be refused, and a control that can do nothing should not
   * be offered — the same call the read-aloud button gets when the voice is
   * off. The refusal stays behind it as a safety net.
   */
  it("offers no pad and no check until the row has been named", async () => {
    const h = render("two_digit");
    expect(h.buttons().filter((l) => /^Digit \d$/.test(l)), "the pad was offered too early").toHaveLength(0);
    expect(h.buttons()).not.toContain("Check");

    const [, , b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const tens = placeValueSplit(Number(b))[0];
    await h.press(`The second row multiplies by ${tens}`);
    expect(h.buttons()).toContain("Digit 4");
    expect(h.buttons()).toContain("Check");
    h.unmount();
  });

  it("accepts the tens and opens the rows", async () => {
    const h = render("two_digit");
    const [, a, b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const [ones, tens] = placeValueSplit(Number(b)).slice().reverse();
    await h.press(`The second row multiplies by ${tens}`);
    expect(h.text()).toContain(`${a} × ${ones}`);
    expect(h.text()).toContain(`${a} × ${tens}`);
    h.unmount();
  });

  it("always splits the multiplier into two real parts", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = buildQuestion({ mode: "two_digit" }, i);
      // `46 × 30` has only one partial row, so there is no second row to ask
      // about — and asking about it is the whole content of the level.
      expect(question.rows).toHaveLength(2);
      expect(String(question.b)).not.toContain("0");
      // The two parts of the multiplier: its ones and its tens, e.g. 6 and 50.
      expect(question.rows[0].multiplier + question.rows[1].multiplier).toBe(question.b);
      expect(question.rows[1].multiplier % 10).toBe(0);
      expect(question.rows[0].value + question.rows[1].value).toBe(question.product);
      // The bare digit is always among the options, because it is the mistake.
      expect(question.multiplierChoices).toContain(question.rows[1].multiplier / 10);
      expect(question.multiplierChoices).toContain(question.rows[1].multiplier);
    }
  });

  /*
   * A row is finished when the child says so.
   *
   * The active row used to be derived from "the first empty one", which moved
   * the cursor the moment a row got its first digit — so a row of 115 was
   * typed in as a 1, a 1 and a 5 spread across three different rows.
   */
  it("keeps typing in the row that was aimed at", async () => {
    const h = render("two_digit");
    const [, a, b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const [ones, tens] = placeValueSplit(Number(b)).slice().reverse();
    await h.press(`The second row multiplies by ${tens}`);
    const value = String(Number(a) * ones);
    await h.press(`${a} × ${ones}, empty`);
    for (const digit of value) await h.press(`Digit ${digit}`);
    expect(h.buttons()).toContain(`${a} × ${ones}, ${value}`);
    expect(h.buttons()).toContain(`${a} × ${tens}, empty`);
    h.unmount();
  });

  it("refuses a check with a row still empty", async () => {
    const h = render("two_digit");
    const [, , b] = /(\d+) × (\d+)\. One row for the ones/.exec(h.text())!;
    const tens = placeValueSplit(Number(b))[0];
    await h.press(`The second row multiplies by ${tens}`);
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/both rows and the total need filling/i);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints all three modes", () => {
  it("prints the sum and a ruled frame to work it in", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = column.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        expect(printed!.text).toContain(`${question.a} × ${question.b}`);
        expect(printed!.answer).toContain(String(question.product));
        expect(column.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        // The ruled columns are the apparatus, so paper gets them too.
        expect(column.worksheet!.figure!(question)).toBeTruthy();
      }
    }
  });

  it("never tells a printed reader to add a zero", () => {
    const forbidden = /add a zero|put a zero|write a zero/i;
    for (let i = 0; i < 40; i += 1) {
      const question = buildQuestion({ mode: "two_digit" }, i);
      expect(column.worksheet!.method!(question)!.join(" ")).not.toMatch(forbidden);
      expect(question.prompt).not.toMatch(forbidden);
    }
  });
});
