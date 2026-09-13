import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  TERMINATING,
  buildDecimalQuestion,
  decimalText,
  explainDecimal,
  fractionFromDecimal,
  isDecimalCorrect,
  nameOf,
  percentOf,
  placesFor,
  rowText,
  type DecimalMode,
  type DecimalQuestion,
} from "./internal/data/fractionDecimal";
import { decimalHints } from "./activities/DecimalBridge";
import { valueOf } from "./internal/data/fractionNumbers";

/**
 * Three names for one number, checked against the number.
 *
 * The conversions are done with integers and then punctuated, never by dividing
 * doubles: `0.1 + 0.2` is not `0.3` in this language, and an answer key built by
 * floating-point division is wrong often enough to matter. These tests hold the
 * exact arithmetic to that standard.
 */

const bridge = skill.activities.decimal;

const MODES: DecimalMode[] = ["tenths", "hundredths", "by_dividing", "from_decimal", "percent", "three_names"];

const questions = (mode: DecimalMode, n = 200): DecimalQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildDecimalQuestion({ mode }, mode, i, seen));
};

/** Answer from the picture, which is the question in its most primitive form. */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  const before = h.koda.count("learning.answered");
  await h.press(correctButton(h));
  expect(h.koda.count("learning.answered")).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `marked wrong — screen: ${h.text().slice(0, 240)}`,
  ).toBe(true);
};

/**
 * Which button is right, worked from the picture rather than from the prompt.
 *
 * The screen says how many of the squares are shaded, which is the question in
 * its most primitive form: a child who counts them has the fraction, and every
 * level here is that fraction under another name.
 */
function correctButton(h: ActivityHarness): string {
  const shaded = /(\d+) of the (\d+) (?:squares|pieces) are shaded/.exec(h.text());
  expect(shaded, `no square count on screen: ${h.text().slice(0, 200)}`).toBeTruthy();
  const [, top, bottom] = shaded as RegExpExecArray;
  const value = Number(top) / Number(bottom);
  const worth = (text: string): number => {
    if (text.includes("·")) return Number(text.split("·")[0].trim());
    if (text.includes("%")) return Number(text.replace("%", "")) / 100;
    if (text.includes("/")) {
      const [a, b] = text.split("/").map(Number);
      return a / b;
    }
    return Number(text);
  };
  const answers = h.buttons().filter((b) => /^[\d./% ·]+$/.test(b));
  // Simplest first: level 46 offers `74/100` beside `37/50`, and the one it is
  // asking for is the one that has been cut down.
  const right = answers
    .filter((b) => Math.abs(worth(b) - value) < 1e-9)
    .sort((a, b) => Number(a.split("/")[1] ?? 1) - Number(b.split("/")[1] ?? 1))[0];
  expect(right, `nothing is worth ${value} — buttons were ${answers.join(", ")}`).toBeTruthy();
  return right as string;
}

describe("the arithmetic is exact, not floating", () => {
  it("writes the decimals a child would write", () => {
    expect(decimalText(3, 4)).toBe("0.75");
    expect(decimalText(1, 8)).toBe("0.125");
    expect(decimalText(7, 10)).toBe("0.7");
    expect(decimalText(40, 100)).toBe("0.4");
    expect(decimalText(1, 50)).toBe("0.02");
    expect(decimalText(13, 20)).toBe("0.65");
  });

  it("never leaves a trailing zero to read as a place", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 80)) {
        expect(q.expected, `${mode}: ${q.prompt}`).not.toMatch(/\.\d*0$/);
      }
    }
  });

  it("knows how many places each bottom number needs", () => {
    expect(placesFor(2)).toBe(1);
    expect(placesFor(4)).toBe(2);
    expect(placesFor(8)).toBe(3);
    expect(placesFor(50)).toBe(2);
    expect(() => placesFor(3)).toThrow(/does not terminate/);
  });

  it("round-trips every terminating fraction through its decimal", () => {
    for (const parts of TERMINATING) {
      for (let taken = 1; taken < parts; taken += 1) {
        const back = fractionFromDecimal(decimalText(taken, parts));
        expect(back.taken / back.parts, `${taken}/${parts}`).toBeCloseTo(taken / parts, 12);
      }
    }
  });

  it("refuses to invent a decimal for a fraction that runs on", () => {
    // `1/3` is 0.333… and a level that drew it would be asking a child to round
    // without having been taught rounding. Better to fail loudly here.
    expect(() => decimalText(1, 3)).toThrow(/does not terminate/);
    expect(() => percentOf(1, 3)).toThrow(/not a whole percent/);
  });
});

describe("every question offers its own answer and nothing worth the same", () => {
  it("holds for all six", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 120)) {
        expect(q.options, `${mode}: ${q.prompt}`).toContain(q.expected);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("asks for exactly one written form, and judges it as written", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        expect(isDecimalCorrect(q, q.expected)).toBe(true);
        for (const other of q.options.filter((o) => o !== q.expected)) {
          expect(isDecimalCorrect(q, other), `${mode}: ${q.prompt} accepted ${other}`).toBe(false);
        }
      }
    }
  });
});

describe("tenths — one place, one digit", () => {
  it("draws only tenths, and only proper ones", () => {
    for (const q of questions("tenths", 120)) {
      expect(q.fraction.parts).toBe(10);
      expect(q.fraction.taken).toBeGreaterThan(0);
      expect(q.fraction.taken).toBeLessThan(10);
      expect(q.grid).toBe(10);
    }
  });

  it("answers with the digit in the first place", () => {
    for (const q of questions("tenths", 80)) {
      expect(q.expected, q.prompt).toBe(`0.${q.fraction.taken}`);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "tenths" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("hundredths — two places, both used", () => {
  it("never draws a number of hundredths that is really tenths", () => {
    // `40/100` is `0.4`, which is the level before this one wearing a disguise.
    for (const q of questions("hundredths", 150)) {
      expect(q.fraction.taken % 10, q.prompt).not.toBe(0);
      expect(q.expected).toMatch(/^0\.\d\d$/);
    }
  });

  it("shades the right number of the hundred squares", async () => {
    const h = renderActivity(bridge, { params: { question: { mode: "hundredths" } } });
    const label = h.screen.getByTestId("hundred").getAttribute("aria-label");
    const shaded = Number(/A hundred squares, (\d+) shaded/.exec(label ?? "")?.[1]);
    expect(h.text()).toContain(`${shaded} of the 100 squares`);
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "hundredths" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("by_dividing — the line was always a division sign", () => {
  it("only draws fractions whose decimals stop", () => {
    for (const q of questions("by_dividing", 200)) {
      expect(TERMINATING, q.prompt).toContain(q.fraction.parts);
      expect(Number(q.expected)).toBeCloseTo(valueOf(q.fraction), 12);
    }
  });

  it("offers the digits-read-straight-off answer, because that is the mistake", () => {
    const naive = questions("by_dividing", 80).filter((q) =>
      q.options.includes(`0.${q.fraction.taken}${q.fraction.parts}`),
    );
    expect(naive.length).toBeGreaterThan(40);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "by_dividing" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("from_decimal — count the places, then cut it down", () => {
  it("asks for the simplest form", () => {
    for (const q of questions("from_decimal", 150)) {
      const [top, bottom] = q.expected.split("/").map(Number);
      const shared = (a: number, b: number): number => (b ? shared(b, a % b) : a);
      expect(shared(top, bottom), `${q.prompt} = ${q.expected}`).toBe(1);
      expect(top / bottom).toBeCloseTo(valueOf(q.fraction), 12);
    }
  });

  it("offers the unsimplified form, where there is one", () => {
    const unsimplified = questions("from_decimal", 120).filter((q) =>
      q.options.includes(nameOf(q.fraction)) && nameOf(q.fraction) !== q.expected,
    );
    expect(unsimplified.length).toBeGreaterThan(20);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "from_decimal" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("percent — hundredths with a different sign", () => {
  it("only draws fractions that are a whole number of percent", () => {
    for (const q of questions("percent", 200)) {
      expect(q.expected, q.prompt).toMatch(/^\d+%$/);
      expect(Number(q.expected.replace("%", ""))).toBe(percentOf(q.fraction.taken, q.fraction.parts));
    }
  });

  it("offers the numerator read as the percentage", () => {
    const naive = questions("percent", 80).filter((q) => q.options.includes(`${q.fraction.taken}%`));
    expect(naive.length).toBeGreaterThan(30);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "percent" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("three_names — one amount, three ways of saying it", () => {
  it("puts the decimal and the percent in one row", () => {
    for (const q of questions("three_names", 120)) {
      expect(q.expected, q.prompt).toBe(rowText(q.fraction));
      expect(q.expected).toMatch(/^[\d.]+ · \d+%$/);
    }
  });

  it("offers the row with the two swapped round", () => {
    const swapped = questions("three_names", 80).filter((q) =>
      q.options.some((o) => o.endsWith("%") && o.startsWith(String(percentOf(q.fraction.taken, q.fraction.parts)))),
    );
    expect(swapped.length).toBeGreaterThan(40);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(bridge, answerRight, {
      params: { question: { mode: "three_names" } },
      questions: 6,
    });
    h.unmount();
  });
});

describe("what the child is told afterwards", () => {
  it("explains the method, not the verdict", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 30)) {
        for (const correct of [true, false]) {
          const text = explainDecimal(q, correct);
          expect(text.split(/\s+/).length, `${mode}: "${text}"`).toBeGreaterThanOrEqual(8);
          expect(text).not.toMatch(/that is (the answer|right|wrong)/i);
          expect(text).not.toMatch(/\b\d+\s?ths?\b/);
        }
      }
    }
  });

  it("says something different when it is wrong", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 20)) {
        expect(explainDecimal(q, true), mode).not.toBe(explainDecimal(q, false));
      }
    }
  });
});

describe("hints climb, and stop short of the answer", () => {
  it("never prints the answer in a hint", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        if (q.prompt.includes(q.expected)) continue;
        for (const hint of decimalHints(q)) {
          expect(hint.includes(q.expected), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(bridge, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
