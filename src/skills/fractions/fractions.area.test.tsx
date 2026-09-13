import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  MAX_GRID,
  buildMultiplyQuestion,
  cancellablePair,
  explainMultiply,
  isCorrectAnswer,
  multiplyBlockedBecause,
  nameOf,
  overlapCells,
  productOf,
  type MultiplyMode,
  type MultiplyQuestion,
} from "./internal/data/fractionMultiply";
import { multiplyHints } from "./activities/AreaGrid";
import { gcd, valueOf } from "./internal/data/fractionNumbers";

/**
 * Multiplying, checked against the quantities rather than the working.
 *
 * Each of the five levels is a different idea wearing the same symbol, so each
 * is driven separately: what makes `2/3 of 18` right is not what makes
 * `2/3 × 3/4` right, and a suite that only checks "the answer equals the
 * product" would pass on a level that draws the wrong picture for it.
 */

const area = skill.activities.multiply;

const MODES: MultiplyMode[] = ["of_whole", "whole_times", "area_model", "simplify_first", "scaling"];

const questions = (mode: MultiplyMode, n = 200): MultiplyQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildMultiplyQuestion({ mode }, mode, i, seen));
};

const textValue = (text: string): number => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return Number(ones) + Number(frac);
  const [top, bottom] = frac.split("/").map(Number);
  return Number(ones) + top / bottom;
};

/** Work the picture into the state the question needs, then press the answer. */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  for (const label of h.buttons().filter((b) => /^Shade /.test(b))) await h.press(label);
  if (h.buttons().some((b) => /^Shade /.test(b))) {
    for (const label of h.buttons().filter((b) => /^Shade /.test(b))) await h.press(label);
  }
  const before = h.koda.count("learning.answered");
  const prompt = h.text();
  // Read the question off the screen and work it out, rather than asking the
  // generator what it decided the answer was.
  const wanted = expectedFromPrompt(prompt);
  /*
   * Among the buttons worth the right amount, the one in simplest form.
   *
   * Level 36 offers `24/36` as well as `2/3`, because stopping before the
   * cancelling is the mistake it is teaching against — so "the first button
   * worth the right amount" is not how a child who did the level answers.
   */
  const right = h
    .buttons()
    .filter((b) => matches(b, wanted))
    .sort((a, b) => denominatorOf(a) - denominatorOf(b))[0];
  expect(right, `nothing on screen answers "${wanted}" — buttons were ${h.buttons().join(", ")}`).toBeTruthy();
  await h.press(right as string);
  expect(
    h.koda.count("learning.answered"),
    `pressing "${right}" was refused — screen said ${h.text().slice(0, 240)}`,
  ).toBe(before + 1);
};

/**
 * What the prompt on screen comes to, worked from the words.
 *
 * Order matters and so does the absence of `\b`: "2/3 of 3/4" starts like
 * "2/3 of 12", and the page has no spaces around the prompt, so a trailing
 * word boundary never arrives — "2/4 of 12Hint" refused to match at all and
 * every round test failed with an empty expectation.
 */
function expectedFromPrompt(text: string): string {
  const scaling = /Is (\d+)\/(\d+) × (\d+) bigger/.exec(text);
  if (scaling) {
    const value = Number(scaling[1]) / Number(scaling[2]);
    return value > 1 ? "Bigger than it was" : value < 1 ? "Smaller than it was" : "Exactly the same";
  }
  const pair = /(\d+)\/(\d+) (?:of|×) (\d+)\/(\d+)/.exec(text);
  if (pair) return `${Number(pair[1]) * Number(pair[3])}/${Number(pair[2]) * Number(pair[4])}`;
  const copies = /(\d+) × (\d+)\/(\d+)/.exec(text);
  if (copies) return `${Number(copies[1]) * Number(copies[2])}/${copies[3]}`;
  const ofWhole = /(\d+)\/(\d+) of (\d+)/.exec(text);
  if (ofWhole) return String((Number(ofWhole[3]) / Number(ofWhole[2])) * Number(ofWhole[1]));
  return "";
}

/** The bottom number of a written answer, or 1 for a whole. */
const denominatorOf = (text: string): number => Number(text.split("/")[1] ?? 1);

/** Same amount, however it is written — "1 3/5" and "8/5" are one answer. */
const matches = (button: string, wanted: string): boolean =>
  /[a-z]/i.test(wanted)
    ? button === wanted
    : /^[\d /]+$/.test(button) && Math.abs(textValue(button) - textValue(wanted)) < 1e-9;

describe("the answer is the quantity, not the digits", () => {
  it("gives every question an id, a prompt and an answer among its options", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 120)) {
        expect(q.id, mode).toBeTruthy();
        expect(q.prompt, mode).toBeTruthy();
        expect(q.options, `${mode}: ${q.prompt}`).toContain(q.expected);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("offers nothing negative, empty or worthless", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 80)) {
        for (const option of q.options) {
          expect(option, `${mode}: ${q.prompt}`).not.toMatch(/-|\/0\b|^0(\/|$)/);
        }
      }
    }
  });
});

describe("of_whole — sharing an amount out", () => {
  it("only ever asks for an amount that shares exactly", () => {
    // "Two thirds of 20" is a real question and a different lesson: the picture
    // here is the amount actually split into groups, and a group of six and two
    // thirds counters cannot be drawn.
    for (const q of questions("of_whole", 200)) {
      expect(q.total! % q.fraction.parts, q.prompt).toBe(0);
    }
  });

  it("answers with the groups taken, not one group", () => {
    for (const q of questions("of_whole", 150)) {
      const perGroup = q.total! / q.fraction.parts;
      expect(Number(q.expected), q.prompt).toBe(perGroup * q.fraction.taken);
    }
  });

  it("survives halves, where every other wrong answer collapses", () => {
    // `1/2 of 18`: one group, the part left over and the answer are all 9.
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const q = buildMultiplyQuestion({ mode: "of_whole", partsRange: [2, 2] }, "of_whole", i, seen);
      expect(q.options.length, q.prompt).toBeGreaterThanOrEqual(3);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(area, answerRight, {
      params: { question: { mode: "of_whole", partsRange: [2, 4], totalRange: [12, 24] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("whole_times — copies, which is repeated addition", () => {
  it("keeps the piece size and multiplies only the count", () => {
    for (const q of questions("whole_times", 150)) {
      expect(textValue(q.expected), q.prompt).toBeCloseTo(q.copies! * valueOf(q.fraction), 10);
    }
  });

  it("draws one bar per copy", () => {
    const h = renderActivity(area, { params: { question: { mode: "whole_times", copiesRange: [4, 4] } } });
    expect(h.screen.getByTestId("copies").children).toHaveLength(4);
    h.unmount();
  });

  it("offers the top-and-bottom-multiplied answer, because that is the mistake", () => {
    const wrong = questions("whole_times", 80).filter((q) =>
      q.options.includes(`${q.fraction.taken * q.copies!}/${q.fraction.parts * q.copies!}`),
    );
    expect(wrong.length).toBeGreaterThan(40);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(area, answerRight, {
      params: { question: { mode: "whole_times", partsRange: [2, 6], copiesRange: [2, 4] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("area_model — a piece of a piece", () => {
  it("puts the answer where the two shadings cross", () => {
    for (const q of questions("area_model", 150)) {
      const { rows, columns, cells } = overlapCells(q.fraction, q.other!);
      expect(cells, q.prompt).toBe(q.fraction.taken * q.other!.taken);
      expect(rows * columns).toBe(q.fraction.parts * q.other!.parts);
      expect(textValue(q.expected)).toBeCloseTo(cells / (rows * columns), 10);
    }
  });

  it("never draws a grid too big to see", () => {
    for (const q of questions("area_model", 150)) {
      expect(q.fraction.parts, q.prompt).toBeLessThanOrEqual(MAX_GRID);
      expect(q.other!.parts).toBeLessThanOrEqual(MAX_GRID);
    }
  });

  it("always makes a piece of a piece smaller than either piece", () => {
    for (const q of questions("area_model", 120)) {
      const answer = textValue(q.expected);
      expect(answer, q.prompt).toBeLessThan(valueOf(q.fraction) + 1e-9);
      expect(answer).toBeLessThan(valueOf(q.other!) + 1e-9);
    }
  });

  it("refuses an answer until the grid is shaded both ways", () => {
    const [q] = questions("area_model", 1);
    expect(multiplyBlockedBecause(q, false, false)).toBe("shade-across");
    expect(multiplyBlockedBecause(q, true, false)).toBe("shade-down");
    expect(multiplyBlockedBecause(q, true, true)).toBe(null);
  });

  it("says so on screen rather than scoring it", async () => {
    const h = renderActivity(area, { params: { question: { mode: "area_model" } } });
    const first = h.buttons().find((b) => /^\d+\/\d+$/.test(b));
    await h.press(first as string);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Shade the first fraction across");
    h.unmount();
  });

  it("shades across, then down, and offers a way back", async () => {
    const h = renderActivity(area, { params: { question: { mode: "area_model" } } });
    expect(h.buttons()).not.toContain("Start over");
    await h.press(h.buttons().find((b) => /^Shade .* across$/.test(b)) as string);
    expect(h.buttons()).toContain("Start over");
    await h.press(h.buttons().find((b) => /^Shade .* down$/.test(b)) as string);
    expect(h.text()).toMatch(/shaded both ways/);
    await h.press("Start over");
    expect(h.buttons().some((b) => /^Shade .* across$/.test(b))).toBe(true);
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(area, answerRight, {
      params: { question: { mode: "area_model", partsRange: [2, 4] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("simplify_first — cancel across the diagonal", () => {
  it("always has something to cancel", () => {
    for (const q of questions("simplify_first", 200)) {
      const diagonal = gcd(q.fraction.parts, q.other!.taken) * gcd(q.fraction.taken, q.other!.parts);
      expect(diagonal, q.prompt).toBeGreaterThan(1);
    }
  });

  it("keeps both fractions proper", () => {
    for (const q of questions("simplify_first", 200)) {
      expect(q.fraction.taken, q.prompt).toBeLessThan(q.fraction.parts);
      expect(q.other!.taken).toBeLessThan(q.other!.parts);
    }
  });

  it("does not ask the same question over and over", () => {
    /*
     * The first version of `cancellablePair` constructed a pair and fell back to
     * a fixed `3/4 × 8/9` whenever the constraints missed — which was 176 draws
     * in 300. A child doing this level twice saw the same question most of the
     * way through both rounds.
     */
    const seen = new Set<string>();
    const drawn = new Map<string, number>();
    for (let i = 0; i < 300; i += 1) {
      const q = buildMultiplyQuestion({ mode: "simplify_first" }, "simplify_first", i, seen);
      drawn.set(q.prompt, (drawn.get(q.prompt) ?? 0) + 1);
    }
    expect(drawn.size).toBeGreaterThan(30);
    expect(Math.max(...drawn.values())).toBeLessThan(40);
  });

  it("builds its pairs without a fallback, at any range", () => {
    for (const [lo, hi] of [[2, 4], [2, 8], [3, 12], [2, 2]] as [number, number][]) {
      for (let i = 0; i < 60; i += 1) {
        const [a, b] = cancellablePair(lo, hi);
        expect(gcd(a.parts, b.taken), `range ${lo}-${hi}`).toBeGreaterThan(1);
        expect(a.taken).toBeLessThan(a.parts);
        expect(b.taken).toBeLessThan(b.parts);
      }
    }
  });

  it("multiplies to the same answer cancelled or not", () => {
    for (const q of questions("simplify_first", 120)) {
      expect(q.expected, q.prompt).toBe(nameOf(productOf(q.fraction, q.other!)));
    }
  });

  it("shows the cancelled form when asked, and not before", async () => {
    const h = renderActivity(area, { params: { question: { mode: "simplify_first" } } });
    expect(h.text()).not.toMatch(/divided top and bottom/);
    await h.press("Cancel first");
    expect(h.text()).toMatch(/divided top and bottom by \d+/);
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(area, answerRight, {
      params: { question: { mode: "simplify_first", partsRange: [2, 6] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("scaling — the level nobody teaches", () => {
  it("draws all three verdicts, not just the one that fits the prejudice", () => {
    const verdicts = new Set(questions("scaling", 60).map((q) => q.verdict));
    expect([...verdicts].sort()).toEqual(["bigger", "same", "smaller"]);
  });

  it("says smaller only when the multiplier really is less than one", () => {
    for (const q of questions("scaling", 200)) {
      const value = valueOf(q.fraction);
      expect(q.expected, q.prompt).toBe(value > 1 ? "bigger" : value < 1 ? "smaller" : "same");
    }
  });

  it("asks for a judgement, not a calculation", () => {
    for (const q of questions("scaling", 40)) {
      expect(q.options.sort()).toEqual(["bigger", "same", "smaller"]);
      expect(q.mustShade).toBe(false);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(area, answerRight, {
      params: { question: { mode: "scaling", partsRange: [2, 6], totalRange: [4, 20] } },
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
          const text = explainMultiply(q, correct);
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
        expect(explainMultiply(q, true), mode).not.toBe(explainMultiply(q, false));
      }
    }
  });
});

describe("hints climb, and stop short of the answer", () => {
  it("never prints the answer in a hint", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        for (const hint of multiplyHints(q)) {
          const written = new RegExp(`(^|[^\\d/])${q.expected.replace("/", "\\/")}([^\\d/]|$)`);
          expect(written.test(hint), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });

  it("tells a child what to look at, not what to feel", () => {
    for (const mode of MODES) {
      const hints = multiplyHints(questions(mode, 1)[0]);
      expect(hints.length).toBeGreaterThanOrEqual(2);
      for (const hint of hints) expect(hint.split(/\s+/).length, hint).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(area, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

describe("the same number in either name is the same answer", () => {
  it("accepts eight fifths where one and three fifths is asked for", () => {
    for (const q of questions("whole_times", 60)) {
      const improper = `${q.fraction.taken * q.copies!}/${q.fraction.parts}`;
      expect(isCorrectAnswer(q, improper), `${q.prompt} = ${q.expected}, rejected ${improper}`).toBe(true);
      expect(isCorrectAnswer(q, q.expected)).toBe(true);
    }
  });

  it("accepts the grid's own reading before it is simplified", () => {
    for (const q of questions("area_model", 60)) {
      const read = `${q.fraction.taken * q.other!.taken}/${q.fraction.parts * q.other!.parts}`;
      expect(isCorrectAnswer(q, read), `${q.prompt}: rejected ${read}`).toBe(true);
    }
  });

  it("does not accept it at level 36, where cancelling is the technique", () => {
    for (const q of questions("simplify_first", 60)) {
      const straight = `${q.fraction.taken * q.other!.taken}/${q.fraction.parts * q.other!.parts}`;
      if (straight === q.expected) continue;
      expect(isCorrectAnswer(q, straight), `${q.prompt}: accepted ${straight}`).toBe(false);
    }
  });

  it("puts two spellings of one amount on the buttons only there", () => {
    for (const mode of MODES) {
      // Level 36 wants both spellings, and level 37's answers are words.
      if (mode === "simplify_first" || mode === "scaling") continue;
      for (const q of questions(mode, 80)) {
        for (let i = 0; i < q.options.length; i += 1) {
          for (let j = i + 1; j < q.options.length; j += 1) {
            expect(
              Math.abs(textValue(q.options[i]) - textValue(q.options[j])),
              `${mode}: ${q.prompt} offers ${q.options[i]} and ${q.options[j]}`,
            ).toBeGreaterThan(1e-9);
          }
        }
      }
    }
  });
});
