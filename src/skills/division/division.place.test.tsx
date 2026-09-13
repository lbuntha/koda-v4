import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildPlaceQuestion,
  friendlySplit,
  placeSplit,
  placeSplitWorks,
  type PlaceMode,
  type PlaceQuestion,
} from "./internal/data/divisionPlace";

const desk = skill.activities.chart;

const questions = (mode: PlaceMode, n = 200): PlaceQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildPlaceQuestion({ mode }, mode, i, seen));
};

const fillParts = async (h: ActivityHarness): Promise<void> => {
  const rows = h.screen
    .queryAllByRole("button")
    .map((b) => b.getAttribute("aria-label") ?? "")
    .filter((n) => /^Answer for \d+ divided by \d+:/.test(n));
  for (const row of rows) {
    const [, part, divisor] = /^Answer for (\d+) divided by (\d+):/.exec(row) ?? [];
    await h.press(row);
    for (const d of String(Number(part) / Number(divisor))) await h.press(`Digit ${d}`);
  }
  await h.press("Check");
};

describe("the split is computed, never assumed", () => {
  it("gives parts that all divide exactly, whatever the numbers", () => {
    for (const mode of ["split_exact", "split_exchange"] as PlaceMode[]) {
      for (const q of questions(mode, 150)) {
        expect(q.parts.reduce((a, b) => a + b, 0), `${q.dividend} ÷ ${q.divisor}`).toBe(q.dividend);
        for (const part of q.parts) expect(part % q.divisor, `${part} ÷ ${q.divisor}`).toBe(0);
        expect(q.partQuotients.reduce((a, b) => a + b, 0)).toBe(q.quotient);
      }
    }
  });

  it("splits 96 by 3 the way the digits read", () => {
    expect(friendlySplit(96, 3)).toEqual([90, 6]);
    expect(placeSplitWorks(96, 3)).toBe(true);
  });

  it("refuses to split 84 by 6 that way, because 80 does not divide", () => {
    expect(placeSplit(84)).toEqual([80, 4]);
    expect(placeSplitWorks(84, 6)).toBe(false);
    expect(friendlySplit(84, 6)).toEqual([60, 24]);
  });
});

describe("split_exact — every place divides on its own", () => {
  it("only ever draws numbers whose digits split", () => {
    for (const q of questions("split_exact")) {
      expect(q.placeSplitWorks, `${q.dividend} ÷ ${q.divisor}`).toBe(true);
      expect(q.parts).toEqual(placeSplit(q.dividend));
    }
  });

  it("runs a full round of part-by-part division", async () => {
    await expectStandardRound(desk, fillParts, {
      params: { question: { mode: "split_exact", divisorRange: [2, 4], quotientRange: [11, 44], totalMax: 200 } },
      questions: 5,
    });
  });
});

describe("split_exchange — the digits refuse", () => {
  it("only ever draws numbers whose digits do NOT split", () => {
    for (const q of questions("split_exchange")) {
      expect(q.placeSplitWorks, `${q.dividend} ÷ ${q.divisor}`).toBe(false);
      expect(q.parts).not.toEqual(placeSplit(q.dividend));
    }
  });

  it("still hands the child a split that works", () => {
    for (const q of questions("split_exchange", 100)) {
      for (const part of q.parts) expect(part % q.divisor).toBe(0);
    }
  });
});

describe("the scaling modes", () => {
  it("divides only by ten and a hundred in scale_down", () => {
    const drawn = questions("scale_down");
    for (const q of drawn) expect([10, 100]).toContain(q.divisor);
    expect(new Set(drawn.map((q) => q.divisor)).size).toBe(2);
  });

  it("uses whole tens on both sides in tens_into_tens", () => {
    for (const q of questions("tens_into_tens")) {
      expect(q.divisor % 10).toBe(0);
      expect(q.dividend % 10).toBe(0);
      expect(q.remainder).toBe(0);
    }
  });

  it("keeps tens_quotient to a round total and a single-digit divisor", () => {
    for (const q of questions("tens_quotient")) {
      expect(q.dividend % 10).toBe(0);
      expect(q.quotient % 10).toBe(0);
      expect(q.divisor).toBeLessThan(10);
    }
  });

  it("asks for one answer, not a split, in the scaling modes", () => {
    for (const mode of ["tens_quotient", "scale_down", "tens_into_tens"] as PlaceMode[]) {
      for (const q of questions(mode, 30)) expect(q.parts).toEqual([q.dividend]);
    }
  });
});

describe("the desk itself", () => {
  it("will not check until every part has been answered", () => {
    const h = renderActivity(desk, { params: { question: { mode: "split_exact" } } });
    expect(h.buttons()).not.toContain("Check");
    h.unmount();
  });

  it("says the total is right but a part is wrong, rather than just wrong", async () => {
    const h = renderActivity(desk, {
      params: { question: { mode: "split_exact", divisorRange: [3, 3], quotientRange: [32, 32] } },
    });
    // 96 / 3 splits as 90 and 6, giving 30 and 2. Answer 29 and 3: total right.
    const rows = h
      .screen.queryAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((n) => /^Answer for /.test(n));
    if (rows.length === 2) {
      await h.press(rows[0]);
      for (const d of "29") await h.press(`Digit ${d}`);
      await h.press(rows[1]);
      for (const d of "3") await h.press(`Digit ${d}`);
      await h.press("Check");
      expect(h.text()).toContain("The total is right, but one of the parts is not.");
    }
    h.unmount();
  });
});
