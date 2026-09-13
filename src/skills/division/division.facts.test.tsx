import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildFactQuestion,
  familyEquations,
  halvingChain,
  helperOptions,
  type FactMode,
  type FactQuestion,
} from "./internal/data/divisionFacts";

const deck = skill.activities.facts;

const questions = (mode: FactMode, n = 200): FactQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildFactQuestion({ mode }, mode, i, seen));
};

const answerFact = async (h: ActivityHarness): Promise<void> => {
  const text = h.text();
  const sum = /(\d+) ÷ (\d+)/.exec(text);
  if (!sum) throw new Error(`no division on screen: ${text.slice(0, 120)}`);
  await h.press(String(Number(sum[1]) / Number(sum[2])));
};

describe("every mode comes out exactly", () => {
  it("never leaves a remainder — these are recall lessons, not remainder ones", () => {
    for (const mode of [
      "family", "table_divide", "missing_factor", "easy_divisors",
      "repeated_halving", "known_multiple", "known_fact",
    ] as FactMode[]) {
      for (const q of questions(mode, 60)) {
        expect(q.remainder, mode).toBe(0);
        expect(q.divisor * q.quotient, mode).toBe(q.dividend);
      }
    }
  });
});

describe("a mode about particular divisors draws only those", () => {
  it("keeps easy_divisors to 2, 5 and 10", () => {
    const drawn = questions("easy_divisors");
    for (const q of drawn) expect([2, 5, 10]).toContain(q.divisor);
    // And draws all three, rather than settling on one.
    expect(new Set(drawn.map((q) => q.divisor)).size).toBe(3);
  });

  it("keeps repeated_halving to 4 and 8", () => {
    const drawn = questions("repeated_halving");
    for (const q of drawn) expect([4, 8]).toContain(q.divisor);
    expect(new Set(drawn.map((q) => q.divisor)).size).toBe(2);
  });

  it("keeps known_multiple to 3, 6 and 9", () => {
    const drawn = questions("known_multiple");
    for (const q of drawn) expect([3, 6, 9]).toContain(q.divisor);
    expect(new Set(drawn.map((q) => q.divisor)).size).toBe(3);
  });
});

describe("the helper is a question, never its own answer", () => {
  it("writes the multiplication with the gap still in it", () => {
    for (const q of questions("easy_divisors", 60)) {
      // The gap is where the answer would be. The digits of the answer may well
      // appear inside the total — 10 x ? = 80 contains an 8 — so the property
      // that matters is the shape, not the absence of a character.
      expect(q.helper).toBe(`${q.divisor} × ? = ${q.dividend}`);
      expect(q.helper.split(" = ")[0]).toContain("?");
    }
  });

  it("halves one step at a time, ending on the answer", () => {
    for (const q of questions("repeated_halving", 60)) {
      const chain = halvingChain(q);
      expect(chain).toHaveLength(q.divisor === 4 ? 2 : 3);
      expect(chain.at(-1)).toContain(`= ${q.quotient}`);
    }
  });
});

describe("family — four true, three not", () => {
  it("offers seven and marks exactly four right", () => {
    for (const q of questions("family", 100)) {
      const { all, correct } = familyEquations(q);
      expect(all).toHaveLength(7);
      expect(correct).toHaveLength(4);
      expect(new Set(all).size).toBe(7);
      for (const c of correct) expect(all).toContain(c);
    }
  });

  it("offers nothing to check until at least one is ticked", async () => {
    const h = renderActivity(deck, { params: { question: { mode: "family" } } });
    // `buttons()` lists only what a child could actually press.
    expect(h.buttons().some((b) => /^Check these/.test(b))).toBe(false);
    const equation = h.buttons().find((b) => /[×÷]/.test(b));
    if (!equation) throw new Error("no equations offered");
    await h.press(equation);
    expect(h.buttons().some((b) => /^Check these/.test(b))).toBe(true);
    expect(h.koda.count("learning.answered"), "ticking is not answering").toBe(0);
    h.unmount();
  });

  it("wants all four and only four", () => {
    for (const q of questions("family", 40)) {
      expect(q.trueEquations).toHaveLength(4);
      expect(q.expected.split(" | ")).toHaveLength(4);
    }
  });
});

describe("known_fact — choose the helper, then use it", () => {
  it("offers four multiplications, exactly one of which reaches the total", () => {
    for (const q of questions("known_fact", 100)) {
      const { all, correct } = helperOptions(q);
      expect(all).toHaveLength(4);
      expect(new Set(all).size).toBe(4);
      expect(all).toContain(correct);
      const reaching = all.filter((t) => t.endsWith(`= ${q.dividend}`));
      expect(reaching, all.join(" | ")).toEqual([correct]);
    }
  });

  it("locks the answer buttons until a helper has been chosen", () => {
    const h = renderActivity(deck, { params: { question: { mode: "known_fact" } } });
    const numbers = h.buttons().filter((b) => /^\d+$/.test(b));
    // Only the helper facts are pressable; a bare number is not yet offered.
    expect(numbers.every((n) => n.includes("×") === false)).toBe(true);
    expect(h.buttons().some((b) => /×/.test(b))).toBe(true);
    h.unmount();
  });
});

describe("table_divide — the grid, read backwards", () => {
  it("lays out the row of the divisor, up to the table ceiling", () => {
    for (const q of questions("table_divide", 60)) {
      expect(q.row).toHaveLength(12);
      expect(q.row?.[0]).toBe(q.divisor);
      expect(q.row).toContain(q.dividend);
      expect((q.row ?? []).indexOf(q.dividend) + 1).toBe(q.quotient);
    }
  });

  it("honours a smaller table when a family has set one", () => {
    const q = buildFactQuestion({ mode: "table_divide", tableCeiling: 10 }, "table_divide", 0);
    expect(q.row).toHaveLength(10);
    expect(q.quotient).toBeLessThanOrEqual(10);
  });
});

describe("the round loop", () => {
  it("runs a full five-question round of easy divisors", async () => {
    await expectStandardRound(deck, answerFact, {
      params: { question: { mode: "easy_divisors" } },
      questions: 5,
    });
  });
});

describe("the helper switch", () => {
  it("hides the helper when inverse_scaffold is off", () => {
    const on = renderActivity(deck, {
      params: { question: { mode: "easy_divisors" } },
      features: { inverse_scaffold: true },
    });
    const shown = /× \?/.test(on.text());
    on.unmount();

    const off = renderActivity(deck, {
      params: { question: { mode: "easy_divisors" } },
      features: { inverse_scaffold: false },
    });
    const hidden = /× \?/.test(off.text());
    off.unmount();

    expect(shown).toBe(true);
    expect(hidden).toBe(false);
  });

  it("never shows it during practice, whatever the switch says", () => {
    const h = renderActivity(deck, {
      params: { question: { practice: true, modes: ["easy_divisors"], questionsPerRound: 4 } },
      features: { inverse_scaffold: true },
    });
    expect(/× \?/.test(h.text())).toBe(false);
    h.unmount();
  });
});
