import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildLineQuestion,
  lineBlockedBecause,
  lineChoices,
  type LineMode,
  type LineQuestion,
} from "./internal/data/divisionLine";

const line = skill.activities.numberline;

const questions = (mode: LineMode, n = 200): LineQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildLineQuestion({ mode }, mode, i, seen));
};

const hopAndAnswer = async (h: ActivityHarness): Promise<void> => {
  for (let guard = 0; guard < 40; guard += 1) {
    const label = h.screen.getByTestId("line").getAttribute("aria-label") ?? "";
    const at = Number(/Marker on (-?\d+)/.exec(label)?.[1] ?? "0");
    if (at === 0) break;
    const hop = h.buttons().find((b) => /^Hop back /.test(b));
    if (!hop) break;
    await h.press(hop);
  }
  const label = h.screen.getByTestId("line").getAttribute("aria-label") ?? "";
  const hops = Number(/(\d+) hops made/.exec(label)?.[1] ?? "0");
  await h.press(String(hops));
};

describe("every question on the line is a grouping question", () => {
  it("is grouping in all three modes — a line cannot show sharing", () => {
    for (const mode of ["back_to_zero", "count_hops", "forward_to_total"] as LineMode[]) {
      for (const q of questions(mode, 60)) {
        expect(q.divisor * q.quotient).toBe(q.dividend);
        expect(q.remainder).toBe(0);
      }
    }
  });
});

describe("back_to_zero — take it away until it is gone", () => {
  it("starts at the total and hops backwards", () => {
    for (const q of questions("back_to_zero")) {
      expect(q.start).toBe(q.dividend);
      expect(q.direction).toBe("back");
      expect(q.prefilled).toBe(false);
    }
  });

  it("refuses an answer part way down the line", () => {
    const [q] = questions("back_to_zero", 1);
    expect(lineBlockedBecause(q, q.dividend)).toBe("not-finished");
    expect(lineBlockedBecause(q, q.divisor)).toBe("not-finished");
    expect(lineBlockedBecause(q, 0)).toBe(null);
    expect(lineBlockedBecause(q, -q.divisor)).toBe("overshot");
  });

  it("runs a full round of real hopping", async () => {
    await expectStandardRound(line, hopAndAnswer, {
      params: { question: { mode: "back_to_zero", divisorRange: [2, 5], quotientRange: [2, 4], totalMax: 20 } },
      questions: 5,
    });
  });
});

describe("count_hops — the hops, not the landing", () => {
  it("draws the line complete and asks only for a reading", () => {
    for (const q of questions("count_hops")) {
      expect(q.prefilled).toBe(true);
      expect(lineBlockedBecause(q, 0)).toBe(null);
    }
  });

  it("offers the landing as an option, because that is the mistake", () => {
    for (const q of questions("count_hops", 80)) {
      const choices = lineChoices(q);
      expect(choices).toContain(q.quotient);
      // The total is the number a child has been staring at. If it is not
      // offered, choosing it is impossible and the level tests nothing.
      expect(choices).toContain(q.dividend);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
    }
  });

  it("tells a child which number they gave when they give the landing", async () => {
    const h = renderActivity(line, {
      params: { question: { mode: "count_hops", divisorRange: [3, 3], quotientRange: [4, 4] } },
    });
    const q = h.screen.getByTestId("line");
    expect(q).toBeTruthy();
    await h.press("12");
    expect(h.text()).toContain("That is a number you landed on");
    h.unmount();
  });
});

describe("forward_to_total — counting up instead of down", () => {
  it("starts at zero and hops forward", () => {
    for (const q of questions("forward_to_total")) {
      expect(q.start).toBe(0);
      expect(q.direction).toBe("forward");
    }
  });

  it("is finished when the marker lands exactly on the total", () => {
    const [q] = questions("forward_to_total", 1);
    expect(lineBlockedBecause(q, 0)).toBe("not-finished");
    expect(lineBlockedBecause(q, q.dividend)).toBe(null);
    expect(lineBlockedBecause(q, q.dividend + q.divisor)).toBe("overshot");
  });
});
