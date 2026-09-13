import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildDivideQuestion,
  divideBlockedBecause,
  divisorsOf,
  explainDivide,
  isDivideCorrect,
  nameOf,
  quotientOf,
  type DivideMode,
  type DivideQuestion,
} from "./internal/data/fractionDivide";
import { divideHints } from "./activities/ShareOut";
import { valueOf } from "./internal/data/fractionNumbers";

/**
 * Dividing, driven from the picture the level claims to be about.
 *
 * The two senses are checked separately and deliberately: measuring counts how
 * many fit and usually gives a bigger number, sharing cuts the pieces again and
 * always gives a smaller one. A suite that only checked "the answer equals the
 * quotient" would pass a level that draws a sharing picture over a measuring
 * question, which is the way this topic is most often taught wrong.
 */

const share = skill.activities.divide;

const MODES: DivideMode[] = ["measure", "whole_by", "by_whole", "by_fraction", "explain_flip"];

const questions = (mode: DivideMode, n = 200): DivideQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildDivideQuestion({ mode }, mode, i, seen));
};

const textValue = (text: string): number => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return Number(ones) + Number(frac);
  const [top, bottom] = frac.split("/").map(Number);
  return Number(ones) + top / bottom;
};

/** Mark the strip if the level asks, then press the answer the picture gives. */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  const marking = h.buttons().find((b) => /^Mark them into/.test(b));
  if (marking) await h.press(marking);
  const wanted = expectedFromScreen(h.text());
  const right = h.buttons().find((b) => matches(b, wanted));
  expect(right, `nothing on screen answers "${wanted}" — buttons were ${h.buttons().join(", ")}`).toBeTruthy();
  const before = h.koda.count("learning.answered");
  await h.press(right as string);
  expect(
    h.koda.count("learning.answered"),
    `pressing "${right}" was refused — screen: ${h.text().slice(0, 240)}`,
  ).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `"${right}" was marked wrong for "${wanted}" — screen: ${h.text().slice(0, 240)}`,
  ).toBe(true);
};

/**
 * What the question on screen comes to, worked from the words.
 *
 * No trailing `\b` anywhere: the page runs the prompt straight into the next
 * element, so "3 ÷ 2/5" is followed immediately by "Hint" and a word boundary
 * never arrives.
 */
function expectedFromScreen(text: string): string {
  const measure = /How many (\w+) fit in (\d+)/.exec(text);
  if (measure) return String(Number(measure[2]) * WORD_PARTS[measure[1]]);
  const flip = /(\d+)\/(\d+) ÷ (\d+)\/(\d+) — which/.exec(text);
  if (flip) return `${flip[1]}/${flip[2]} × ${flip[4]}/${flip[3]}`;
  // Most specific first: "1/2 ÷ 1/4" also contains "2 ÷ 1/4", and reading it
  // as a whole divided by a fraction gave an answer no button could match.
  const byFraction = /(\d+)\/(\d+) ÷ (\d+)\/(\d+)/.exec(text);
  if (byFraction) {
    return `${Number(byFraction[1]) * Number(byFraction[4])}/${Number(byFraction[2]) * Number(byFraction[3])}`;
  }
  const wholeBy = /(\d+) ÷ (\d+)\/(\d+)/.exec(text);
  if (wholeBy) return String((Number(wholeBy[1]) * Number(wholeBy[3])) / Number(wholeBy[2]));
  const shared = /(\d+)\/(\d+) shared between (\d+)/.exec(text);
  if (shared) return `${shared[1]}/${Number(shared[2]) * Number(shared[3])}`;
  return "";
}

const WORD_PARTS: Record<string, number> = {
  halves: 2,
  thirds: 3,
  quarters: 4,
  fifths: 5,
  sixths: 6,
  sevenths: 7,
  eighths: 8,
};

/** The same amount however it is written; a written rule has to match exactly. */
const matches = (button: string, wanted: string): boolean =>
  /×/.test(wanted)
    ? button === wanted
    : /^[\d /]+$/.test(button) && Math.abs(textValue(button) - textValue(wanted)) < 1e-9;

describe("every question knows which of the two divisions it is", () => {
  it("calls measuring measuring and sharing sharing", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        expect(q.sense, `${mode}: ${q.prompt}`).toBe(mode === "by_whole" ? "share" : "measure");
      }
    }
  });

  it("gives every question an answer among its options, written once", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 120)) {
        expect(q.options, `${mode}: ${q.prompt}`).toContain(q.expected);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("offers nothing negative or worthless", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 80)) {
        for (const option of q.options) expect(option, `${mode}: ${q.prompt}`).not.toMatch(/-|\/0\b|^0(\/|$)/);
      }
    }
  });
});

describe("measure — the answer is bigger, and the strip proves it", () => {
  it("counts every piece in every whole one", () => {
    for (const q of questions("measure", 200)) {
      expect(Number(q.expected), q.prompt).toBe(q.whole! * q.divisor!.parts);
    }
  });

  it("always answers with more than it started with", () => {
    // The point of the level: dividing by something under one gives you more.
    for (const q of questions("measure", 200)) {
      expect(Number(q.expected), q.prompt).toBeGreaterThan(q.whole!);
    }
  });

  it("measures with a unit fraction, since that is what is being counted", () => {
    for (const q of questions("measure", 100)) expect(q.divisor!.taken, q.prompt).toBe(1);
  });

  it("refuses an answer until the strip is marked", () => {
    const [q] = questions("measure", 1);
    expect(q.mustMark).toBe(true);
    expect(divideBlockedBecause(q, false)).toBe("mark-the-strip");
    expect(divideBlockedBecause(q, true)).toBe(null);
  });

  it("says so on screen rather than scoring it", async () => {
    const h = renderActivity(share, { params: { question: { mode: "measure" } } });
    await h.press(h.buttons().find((b) => /^\d+$/.test(b)) as string);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("Mark the strip into those pieces first");
    h.unmount();
  });

  it("marks the strips when asked, and can put them back", async () => {
    const h = renderActivity(share, { params: { question: { mode: "measure" } } });
    expect(h.buttons()).not.toContain("Start over");
    await h.press(h.buttons().find((b) => /^Mark them into/.test(b)) as string);
    expect(h.text()).toMatch(/every whole one holds \d+/);
    expect(h.buttons()).toContain("Start over");
    await h.press("Start over");
    expect(h.buttons().some((b) => /^Mark them into/.test(b))).toBe(true);
    h.unmount();
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(share, answerRight, {
      params: { question: { mode: "measure", partsRange: [2, 5], wholeRange: [2, 4] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("whole_by — grouping the pieces up", () => {
  it("only draws divisions that come out whole", () => {
    /*
     * `4 ÷ 3/5` is six and two thirds, which is true and is level 41's job. The
     * picture here is pieces grouped off a strip, and two thirds of a group is
     * not a thing a child can point at.
     */
    for (const q of questions("whole_by", 200)) {
      expect(Number.isInteger(Number(q.expected)), `${q.prompt} = ${q.expected}`).toBe(true);
      expect(textValue(q.expected)).toBeCloseTo(q.whole! / valueOf(q.divisor!), 10);
    }
  });

  it("divides by a proper fraction, so the answer grows", () => {
    for (const q of questions("whole_by", 150)) {
      expect(q.divisor!.taken, q.prompt).toBeLessThan(q.divisor!.parts);
      expect(Number(q.expected)).toBeGreaterThan(q.whole!);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(share, answerRight, {
      params: { question: { mode: "whole_by", partsRange: [2, 6], wholeRange: [2, 5] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("by_whole — sharing, where the pieces get smaller", () => {
  it("makes every share smaller than the amount being shared", () => {
    for (const q of questions("by_whole", 200)) {
      expect(textValue(q.expected), q.prompt).toBeLessThan(valueOf(q.dividend!));
      expect(textValue(q.expected)).toBeCloseTo(valueOf(q.dividend!) / q.shares!, 10);
    }
  });

  it("cuts the pieces rather than sharing the count", () => {
    // `3/4 ÷ 2` is `3/8`, not `1.5/4`. The bottom number is what changes.
    for (const q of questions("by_whole", 150)) {
      const answer = textValue(q.expected);
      expect(answer * q.shares!).toBeCloseTo(valueOf(q.dividend!), 10);
      expect(q.expected).toMatch(/^\d+\/\d+$/);
    }
  });

  it("never asks a child to mark a strip that is already drawn", () => {
    for (const q of questions("by_whole", 40)) expect(q.mustMark, q.prompt).toBe(false);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(share, answerRight, {
      params: { question: { mode: "by_whole", partsRange: [2, 6], sharesRange: [2, 4] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("by_fraction — the same question, harder numbers", () => {
  it("answers with the real quotient, over or under one", () => {
    for (const q of questions("by_fraction", 200)) {
      expect(textValue(q.expected), q.prompt).toBeCloseTo(valueOf(q.dividend!) / valueOf(q.divisor!), 10);
    }
  });

  it("draws both under and over one, since both are true answers", () => {
    const values = questions("by_fraction", 120).map((q) => textValue(q.expected));
    expect(values.some((v) => v < 1)).toBe(true);
    expect(values.some((v) => v > 1)).toBe(true);
  });

  it("agrees with working it out by flipping", () => {
    for (const q of questions("by_fraction", 120)) {
      const { ones, fraction } = quotientOf(q.dividend!, q.divisor!);
      const written = fraction.taken === 0 ? String(ones) : ones === 0 ? nameOf(fraction) : `${ones} ${nameOf(fraction)}`;
      expect(q.expected, q.prompt).toBe(written);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(share, answerRight, {
      params: { question: { mode: "by_fraction", partsRange: [2, 5] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("explain_flip — the rule, with a reason under it", () => {
  it("asks for a multiplication, not a number", () => {
    for (const q of questions("explain_flip", 120)) {
      expect(q.expected, q.prompt).toMatch(/^\d+\/\d+ × \d+\/\d+$/);
      for (const option of q.options) expect(option).toMatch(/×/);
    }
  });

  it("flips the second fraction and only the second", () => {
    for (const q of questions("explain_flip", 150)) {
      expect(q.expected).toBe(`${nameOf(q.dividend!)} × ${q.divisor!.parts}/${q.divisor!.taken}`);
    }
  });

  it("offers the three ways of flipping it wrong", () => {
    for (const q of questions("explain_flip", 60)) {
      const wrong = q.options.filter((o) => o !== q.expected);
      expect(wrong.length, q.prompt).toBeGreaterThanOrEqual(2);
      for (const option of wrong) expect(isDivideCorrect(q, option), `${q.prompt}: ${option}`).toBe(false);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(share, answerRight, {
      params: { question: { mode: "explain_flip", partsRange: [2, 5] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("the same number in either name is the same answer", () => {
  it("accepts the improper form where a mixed one is written", () => {
    for (const q of questions("by_fraction", 80)) {
      if (!q.expected.includes(" ")) continue;
      const [ones, frac] = q.expected.split(" ");
      const [top, bottom] = frac.split("/").map(Number);
      const improper = `${Number(ones) * bottom + top}/${bottom}`;
      expect(isDivideCorrect(q, improper), `${q.prompt} = ${q.expected}, rejected ${improper}`).toBe(true);
    }
  });

  it("keeps the written rule exact at level 42", () => {
    for (const q of questions("explain_flip", 40)) {
      expect(isDivideCorrect(q, `${nameOf(q.dividend!)} × ${nameOf(q.divisor!)}`)).toBe(false);
    }
  });
});

describe("what the child is told afterwards", () => {
  it("explains the method, not the verdict", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 30)) {
        for (const correct of [true, false]) {
          const text = explainDivide(q, correct);
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
        expect(explainDivide(q, true), mode).not.toBe(explainDivide(q, false));
      }
    }
  });
});

describe("hints climb, and stop short of the answer", () => {
  it("never prints the answer in a hint", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        // A hint may repeat the question's own numbers: `1/4 ÷ 1/2` has the
        // answer `1/2`, and "how many 1/2 fit inside 1/4" is the question read
        // back, not the answer given away.
        if (q.prompt.includes(q.expected)) continue;
        for (const hint of divideHints(q)) {
          const written = new RegExp(`(^|[^\\d/])${q.expected.replace(/[/\\\\^$*+?.()|[\]{}]/g, "\\$&")}([^\\d/]|$)`);
          expect(written.test(hint), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });
});

describe("the small arithmetic this engine leans on", () => {
  it("lists every divisor, including one and the number itself", () => {
    expect(divisorsOf(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(divisorsOf(7)).toEqual([1, 7]);
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(share, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
