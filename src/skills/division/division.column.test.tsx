import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  answerMatches,
  buildColumnQuestion,
  hasZeroInside,
  judgeDigit,
  type ColumnMode,
  type ColumnQuestion,
} from "./internal/data/divisionColumn";
import { exchangesIn, shortDivisionSteps } from "./internal/data/divisionNumbers";

const pad = skill.activities.column;

const questions = (mode: ColumnMode, n = 200): ColumnQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildColumnQuestion({ mode }, mode, i, seen));
};

/** Type the whole answer, digit by digit, the way the method goes. */
const workIt = async (h: ActivityHarness): Promise<void> => {
  const sum = /(\d+) ÷ (\d+)/.exec(h.text());
  if (!sum) throw new Error("no division on screen");
  const steps = shortDivisionSteps(Number(sum[1]), Number(sum[2]));
  for (const step of steps) await h.press(`Digit ${step.quotientDigit}`);
  const left = steps[steps.length - 1].carry;
  if (h.screen.queryByTestId("remainder-slot")) {
    for (const d of String(left)) await h.press(`Digit ${d}`);
  }
  await h.press("Check");
};

describe("a digit is judged where it is written", () => {
  it("names the two things that can go wrong, and nothing else", () => {
    // 43 ÷ 7: 6 fits, 5 leaves 8 which is still more than 7, 7 overshoots.
    expect(judgeDigit(43, 7, 6)).toBe("ok");
    expect(judgeDigit(43, 7, 5)).toBe("too-small");
    expect(judgeDigit(43, 7, 7)).toBe("too-big");
    expect(judgeDigit(6, 7, 0)).toBe("ok");
  });

  it("accepts exactly one digit at every step of every drawn question", () => {
    for (const mode of ["short_exact", "short_exchange", "long_exact"] as ColumnMode[]) {
      for (const q of questions(mode, 60)) {
        for (const step of q.steps) {
          const ok = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
            (d) => judgeDigit(step.working, q.divisor, d) === "ok",
          );
          expect(ok, `${step.working} ÷ ${q.divisor}`).toEqual([step.quotientDigit]);
        }
      }
    }
  });

  it("refuses a wrong digit on screen instead of scoring the round", async () => {
    const h = renderActivity(pad, {
      params: { question: { mode: "short_exact", divisorRange: [3, 3], quotientRange: [31, 31] } },
    });
    // 93 ÷ 3: the first digit is 3. Anything else is refused where it is typed.
    await h.press("Digit 9");
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toMatch(/more than there is|still fits/);
    h.unmount();
  });
});

describe("each mode draws the shape its title claims", () => {
  it("short_exact never carries", () => {
    for (const q of questions("short_exact")) {
      expect(exchangesIn(q.dividend, q.divisor), `${q.dividend} ÷ ${q.divisor}`).toBe(0);
      expect(q.remainder).toBe(0);
    }
  });

  it("short_exchange always carries", () => {
    for (const q of questions("short_exchange")) {
      expect(exchangesIn(q.dividend, q.divisor)).toBeGreaterThan(0);
      expect(q.remainder).toBe(0);
    }
  });

  it("short_remainder always leaves something", () => {
    for (const q of questions("short_remainder")) {
      expect(q.remainder).toBeGreaterThan(0);
      expect(q.remainder).toBeLessThan(q.divisor);
      expect(q.wantsRemainder).toBe(true);
    }
  });

  it("zero_digit always puts a zero INSIDE the answer", () => {
    for (const q of questions("zero_digit")) {
      expect(hasZeroInside(q), `quotient ${q.quotient}`).toBe(true);
      // Not leading, not trailing: a real place holding nothing.
      const digits = String(q.quotient).split("");
      expect(digits[0]).not.toBe("0");
      expect(digits.slice(1, -1)).toContain("0");
    }
  });

  it("the long modes use a two-digit divisor", () => {
    for (const q of questions("long_exact", 80)) expect(q.divisor).toBeGreaterThan(9);
    for (const q of questions("long_remainder", 80)) {
      expect(q.divisor).toBeGreaterThan(9);
      expect(q.remainder).toBeGreaterThan(0);
    }
  });
});

describe("decimal_tail — past the point", () => {
  it("always has something to carry past the point", () => {
    for (const q of questions("decimal_tail")) {
      expect(q.remainder).toBeGreaterThan(0);
      expect(q.hasDecimal).toBe(true);
    }
  });

  it("terminates inside two places, so no lesson ends in dots", () => {
    for (const q of questions("decimal_tail")) {
      expect(q.decimalDigits.length).toBeGreaterThan(0);
      expect(q.decimalDigits.length).toBeLessThanOrEqual(2);
      // The tail really does finish: rebuilt, it gives the dividend back.
      const value = q.quotient + Number(`0.${q.decimalDigits.join("")}`);
      expect(Math.round(value * q.divisor * 100) / 100).toBe(q.dividend);
    }
  });

  it("does not ask for a remainder as well", () => {
    for (const q of questions("decimal_tail", 40)) expect(q.wantsRemainder).toBe(false);
  });
});

describe("the answer is only right when every part is", () => {
  it("rejects right digits with a wrong remainder", () => {
    const [q] = questions("short_remainder", 1);
    expect(answerMatches(q, q.quotientDigits, String(q.remainder), [])).toBe(true);
    expect(answerMatches(q, q.quotientDigits, String(q.remainder + 1), [])).toBe(false);
  });

  it("rejects a right total built from wrong digits", () => {
    const [q] = questions("short_exact", 1);
    const wrong = [...q.quotientDigits];
    wrong[0] = (wrong[0] + 1) % 10;
    expect(answerMatches(q, wrong, "", [])).toBe(false);
  });
});

describe("the round loop", () => {
  it("runs a full round of short division", async () => {
    await expectStandardRound(pad, workIt, {
      params: { question: { mode: "short_exact", divisorRange: [2, 4], quotientRange: [11, 200], totalMax: 800 } },
      questions: 5,
    });
  });

  it("runs a full round of long division", async () => {
    await expectStandardRound(pad, workIt, {
      params: { question: { mode: "long_exact", divisorRange: [11, 40], quotientRange: [11, 50] } },
      questions: 5,
    });
  });
});
