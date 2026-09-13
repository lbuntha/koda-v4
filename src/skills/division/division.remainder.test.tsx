import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  answerFor,
  buildRemainderQuestion,
  pairBlockedBecause,
  type Reading,
  type RemainderMode,
  type RemainderQuestion,
} from "./internal/data/divisionRemainder";

const yard = skill.activities.remainder;

const questions = (mode: RemainderMode, n = 200): RemainderQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildRemainderQuestion({ mode }, mode, i, seen));
};

/** Type the pair the question wants, as a child does on the pad. */
const typePair = async (h: ActivityHarness): Promise<void> => {
  const sum = /(\d+) ÷ (\d+)/.exec(h.text());
  if (!sum) throw new Error("no division on screen");
  const dividend = Number(sum[1]);
  const divisor = Number(sum[2]);
  const q = Math.floor(dividend / divisor);
  const r = dividend % divisor;
  await h.press(`How many whole groups: empty`);
  for (const d of String(q)) await h.press(`Digit ${d}`);
  await h.press(/^Left over: /);
  for (const d of String(r)) await h.press(`Digit ${d}`);
  await h.press("Check");
};

describe("every question here leaves something over", () => {
  it("never draws a division that comes out exactly", () => {
    for (const mode of ["record", "too_big", "interpret", "choose_form"] as RemainderMode[]) {
      for (const q of questions(mode, 60)) {
        expect(q.remainder, mode).toBeGreaterThan(0);
        expect(q.remainder, mode).toBeLessThan(q.divisor);
        expect(q.quotient * q.divisor + q.remainder, mode).toBe(q.dividend);
      }
    }
  });
});

describe("record — the pair, typed", () => {
  it("wants both halves and will not take one", () => {
    const [q] = questions("record", 1);
    expect(q.wantsPair).toBe(true);
    expect(pairBlockedBecause(q, "", "")).toBe("incomplete");
    expect(pairBlockedBecause(q, String(q.quotient), "")).toBe("incomplete");
    expect(pairBlockedBecause(q, String(q.quotient), String(q.remainder))).toBe(null);
  });

  it("refuses a remainder that is not smaller than the divisor", () => {
    const [q] = questions("record", 1);
    expect(pairBlockedBecause(q, "1", String(q.divisor))).toBe("remainder-too-big");
    expect(pairBlockedBecause(q, "1", String(q.divisor + 3))).toBe("remainder-too-big");
  });

  it("says so on screen rather than marking it wrong", async () => {
    const h = renderActivity(yard, {
      params: { question: { mode: "record", divisorRange: [5, 5], quotientRange: [3, 3] } },
    });
    await h.press(/^How many whole groups/);
    await h.press("Digit 1");
    await h.press(/^Left over: /);
    await h.press("Digit 9");
    await h.press("Check");
    expect(h.koda.count("learning.answered"), "nothing scored").toBe(0);
    expect(h.text()).toContain("The leftover has to be smaller");
    h.unmount();
  });

  it("runs a full round of typed pairs", async () => {
    await expectStandardRound(yard, typePair, {
      params: { question: { mode: "record", divisorRange: [3, 7], quotientRange: [2, 9], totalMax: 60 } },
      questions: 5,
    });
  });

  it("follows the family's chosen notation", () => {
    const rem = renderActivity(yard, {
      params: { question: { mode: "record" } },
      settings: { remainderNotation: "rem" },
    });
    expect(rem.text()).toContain("rem");
    rem.unmount();
  });
});

describe("too_big — an answer that balances and is still wrong", () => {
  it("offers a wrong answer whose arithmetic checks out", () => {
    for (const q of questions("too_big", 100)) {
      const wrong = q.wrong;
      if (!wrong) throw new Error("too_big must carry a wrong answer");
      // It adds up — which is why a child cannot catch it by re-adding.
      expect(wrong.quotient * q.divisor + wrong.remainder).toBe(q.dividend);
      // And it is wrong in exactly one way: the leftover is too big.
      expect(wrong.remainder).toBeGreaterThanOrEqual(q.divisor);
      expect(wrong.quotient).toBeLessThan(q.quotient);
    }
  });
});

describe("interpret — one sum, four answers", () => {
  it("asks all four readings across a round", () => {
    const drawn = questions("interpret", 8);
    expect(new Set(drawn.map((q) => q.reading)).size).toBe(4);
  });

  it("wants a different number for each reading", () => {
    for (const q of questions("interpret", 60)) {
      expect(answerFor(q, "round-up")).toBe(q.quotient + 1);
      expect(answerFor(q, "round-down")).toBe(q.quotient);
      expect(answerFor(q, "the-remainder")).toBe(q.remainder);
    }
  });

  it("keeps the situation the same so only the question changes", () => {
    // Four questions built from one index pattern share their wording style;
    // what must differ is the ending, never the subject matter of the ask.
    for (const q of questions("interpret", 40)) {
      expect(q.story).toBeTruthy();
      expect(q.prompt).not.toBe(q.story);
    }
  });
});

describe("choose_form — four answers, same numbers", () => {
  it("offers one written answer per reading, exactly one right", () => {
    for (const q of questions("choose_form", 100)) {
      const options = q.options ?? [];
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      expect(options.filter((o) => o === q.expected)).toHaveLength(1);
    }
  });

  it("writes the units out, so the same digit means two different things", () => {
    for (const q of questions("choose_form", 40)) {
      for (const option of q.options ?? []) {
        expect(option).toMatch(/[a-z]/);
      }
    }
  });

  it("is answered by choosing, never by typing", () => {
    for (const q of questions("choose_form", 20)) expect(q.wantsPair).toBe(false);
  });
});

const READINGS: Reading[] = ["round-up", "round-down", "the-remainder", "both"];
describe("the four readings", () => {
  it("covers every one of them", () => {
    expect(READINGS).toHaveLength(4);
    const [q] = questions("interpret", 1);
    for (const reading of READINGS) expect(answerFor(q, reading)).toBeGreaterThanOrEqual(0);
  });
});
