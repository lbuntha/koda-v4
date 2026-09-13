import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  MAX_COMMON,
  addBlockedBecause,
  addOptions,
  answerOf,
  answerText,
  buildAddQuestion,
  explainAdd,
  isAddCorrect,
  matchedPair,
  nameOf,
  refuteQuestion,
  type AddMode,
  type AddQuestion,
} from "./internal/data/fractionAdd";
import { addHints } from "./activities/AddStrip";
import { valueOf } from "./internal/data/fractionNumbers";

/**
 * Adding, driven the way a child drives it.
 *
 * The arithmetic is checked against the *quantities*, never against the
 * generator's own working: a test that recomputes the answer the way the
 * builder computed it agrees with a bug as readily as with a fix. Here the
 * claim is that `left + right` as real numbers equals what the screen says.
 */

const strip = skill.activities.add;

const LIVE: AddMode[] = [
  "add_like",
  "subtract_like",
  "refute",
  "add_nested",
  "add_unlike",
  "subtract_unlike",
  "add_mixed",
  "subtract_mixed",
];

const questions = (mode: AddMode, n = 200): AddQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildAddQuestion({ mode }, mode, i, seen));
};

/** What the answer text means as a number, mixed numbers and wholes included. */
const textValue = (text: string): number => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return Number(ones) + Number(frac);
  const [top, bottom] = frac.split("/").map(Number);
  return Number(ones) + top / bottom;
};

const trueTotal = (q: AddQuestion): number => {
  const l = q.leftOnes + valueOf(q.left);
  const r = q.rightOnes + valueOf(q.right);
  return q.operation === "add" ? l + r : l - r;
};

/**
 * Answer one question correctly — by doing the sum, not by asking the generator.
 *
 * The prompt on screen is the whole question, so the test reads it, works out
 * what it comes to, and presses the button worth that much. A helper that asked
 * the builder for its own answer would agree with a builder that is wrong.
 */
const promptValue = (text: string): number => {
  const [, left, op, right] = /^(.+?)\s*([+−])\s*(.+)$/.exec(text.trim()) ?? [];
  if (!left) return NaN;
  const v = (side: string) => textValue(side.trim());
  return op === "+" ? v(left) + v(right) : v(left) - v(right);
};

const answerRight = async (h: ActivityHarness): Promise<void> => {
  if (h.buttons().includes("Cut them to match")) await h.press("Cut them to match");
  const claimed = /Somebody says (.+?) = /.exec(h.text());
  const raw = claimed ? claimed[1] : (/([\d /]+[+−][\d /]+)/.exec(h.text()) as string[])?.[1] ?? "";
  const sum = promptValue(raw);
  const right = h
    .buttons()
    .filter((b) => /^\d/.test(b))
    .find((b) => Math.abs(textValue(b) - sum) < 1e-9);
  expect(right, `no button is worth ${sum} — options were ${h.buttons().join(", ")}`).toBeTruthy();
  const before = h.koda.count("learning.answered");
  await h.press(right as string);
  // A refusal looks like a press that did nothing, and a round that stalls on
  // one is reported as a missing "Next" button three frames later.
  expect(
    h.koda.count("learning.answered"),
    `pressing "${right}" was refused — the screen said: ${h.text().slice(0, 300)}`,
  ).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `"${right}" was worth ${sum} for "${raw}" and was marked wrong — screen: ${h.text().slice(0, 300)}`,
  ).toBe(true);
};

describe("the answer is the quantity, not the digits", () => {
  it("matches the real sum for every mode", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 120)) {
        expect(textValue(q.expected), `${mode}: ${q.prompt}`).toBeCloseTo(trueTotal(q), 10);
      }
    }
  });

  it("computes from the matched pair, so both sides agree", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 80)) {
        const m = matchedPair(q);
        expect(m.left.parts).toBe(q.common);
        expect(m.right.parts).toBe(q.common);
        expect(valueOf(m.left)).toBeCloseTo(valueOf(q.left), 10);
        expect(valueOf(m.right)).toBeCloseTo(valueOf(q.right), 10);
        expect(answerText(answerOf(q))).toBe(q.expected);
      }
    }
  });

  it("never writes a fraction of a piece", () => {
    // `1.5/3` shipped in the first draft of this generator, from swapping a
    // numerator matched against sixths back over thirds.
    for (const mode of LIVE) {
      for (const q of questions(mode, 150)) {
        for (const f of [q.left, q.right, matchedPair(q).left, matchedPair(q).right]) {
          expect(Number.isInteger(f.taken), `${mode}: ${nameOf(f)}`).toBe(true);
          expect(Number.isInteger(f.parts)).toBe(true);
          expect(f.taken).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps every drawing inside what a strip can show", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 120)) {
        expect(q.common, `${mode}: ${q.prompt}`).toBeLessThanOrEqual(MAX_COMMON);
      }
    }
  });

  it("never goes below zero, in any of the three ways of taking away", () => {
    for (const mode of ["subtract_like", "subtract_unlike", "subtract_mixed"] as AddMode[]) {
      for (const q of questions(mode, 150)) {
        expect(trueTotal(q), `${mode}: ${q.prompt}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("add_like — the pieces already match", () => {
  it("draws one denominator, not two", () => {
    for (const q of questions("add_like", 120)) {
      expect(q.left.parts, q.prompt).toBe(q.right.parts);
      expect(q.common).toBe(q.left.parts);
    }
  });

  it("asks for no matching, because there is nothing to match", () => {
    for (const q of questions("add_like", 60)) {
      expect(q.mustMatch).toBe(false);
      expect(addBlockedBecause(q, false)).toBe(null);
    }
  });

  it("crosses the whole about half the time", () => {
    // Both halves are the lesson: `2/8 + 3/8` is counting, and `5/8 + 6/8` is
    // counting plus the renaming levels 22 and 23 just taught.
    const past = questions("add_like", 200).filter((q) => trueTotal(q) > 1).length;
    expect(past).toBeGreaterThan(50);
    expect(past).toBeLessThan(150);
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "add_like", partsRange: [4, 8] } },
      questions: 5,
    });
  });
});

describe("subtract_like — counting backwards", () => {
  it("takes the smaller from the larger", () => {
    for (const q of questions("subtract_like", 150)) {
      expect(q.left.taken, q.prompt).toBeGreaterThan(q.right.taken);
      expect(q.left.parts).toBe(q.right.parts);
    }
  });

  it("leaves something behind", () => {
    for (const q of questions("subtract_like", 150)) {
      expect(textValue(q.expected), q.prompt).toBeGreaterThan(0);
    }
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "subtract_like", partsRange: [5, 10] } },
      questions: 5,
    });
  });
});

describe("refute — the wrong answer, on purpose", () => {
  it("shows a claim that really is wrong, and wrong in the usual direction", () => {
    for (let i = 0; i < 20; i += 1) {
      const q = refuteQuestion(i);
      const claim = valueOf(q.claim!);
      expect(claim, q.prompt).toBeLessThan(trueTotal(q));
      // Too small is the point: adding the bottoms makes the pieces smaller.
      expect(claim).toBeLessThan(Math.max(valueOf(q.left), valueOf(q.right)) + 1e-9);
      expect(q.claim!.parts).toBe(q.left.parts + q.right.parts);
    }
  });

  it("offers the claim as an answer, so refusing it is a choice", () => {
    for (let i = 0; i < 10; i += 1) {
      const q = refuteQuestion(i);
      expect(q.options).toContain(nameOf(q.claim!));
      expect(q.options).toContain(q.expected);
    }
  });

  it("will not take an answer until the pieces are cut to match", () => {
    const q = refuteQuestion(0);
    expect(q.mustMatch).toBe(true);
    expect(addBlockedBecause(q, false)).toBe("pieces-differ");
    expect(addBlockedBecause(q, true)).toBe(null);
  });

  it("says so on screen rather than scoring it", async () => {
    const h = renderActivity(strip, { params: { question: { mode: "refute" } } });
    const first = h.buttons().find((b) => /^\d+\/\d+$/.test(b));
    await h.press(first as string);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.text()).toContain("different sizes");
    h.unmount();
  });

  it("cuts both strips to the same size when asked", async () => {
    const h = renderActivity(strip, { params: { question: { mode: "refute" } } });
    await h.press("Cut them to match");
    expect(h.text()).toMatch(/both are \w+s now/);
    h.unmount();
  });

  it("lets a child put the strips back the way they were", async () => {
    // The uncut strips are the evidence. A child who has cut them, answered and
    // been told they were wrong should be able to look at the claim again.
    const h = renderActivity(strip, { params: { question: { mode: "refute" } } });
    expect(h.buttons()).not.toContain("Start over");
    await h.press("Cut them to match");
    expect(h.buttons()).toContain("Start over");
    await h.press("Start over");
    expect(h.buttons()).toContain("Cut them to match");
    expect(h.buttons()).not.toContain("Start over");
    h.unmount();
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "refute" } },
      questions: 5,
    });
  });
});

describe("the four answers are the ones children write", () => {
  it("always offers the right one, and four distinct answers", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 80)) {
        const options = q.options ?? addOptions(q);
        expect(options, `${mode}: ${q.prompt}`).toContain(q.expected);
        expect(new Set(options).size).toBe(options.length);
        expect(options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("offers nothing negative or empty", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 80)) {
        for (const text of q.options ?? []) {
          expect(text, `${mode}: ${q.prompt} offered ${text}`).not.toMatch(/-|\/0\b|^0\//);
          expect(textValue(text)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("includes adding straight across, where that is a different answer", () => {
    // The misconception has to be on the screen to be refused.
    const across = questions("add_like", 60).filter((q) => {
      const wrong = `${q.left.taken + q.right.taken}/${q.left.parts + q.right.parts}`;
      return (q.options ?? []).includes(wrong);
    });
    expect(across.length).toBeGreaterThan(30);
  });
});

describe("what the child is told afterwards", () => {
  it("explains the method, not the verdict", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 40)) {
        for (const correct of [true, false]) {
          const text = explainAdd(q, correct);
          expect(text.split(/\s+/).length, `${mode}: "${text}"`).toBeGreaterThanOrEqual(7);
          expect(text).not.toMatch(/that is (the answer|right|wrong)/i);
          expect(text).not.toMatch(/\b\d+\s?ths?\b/);
        }
      }
    }
  });

  it("says something different when it is wrong", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 30)) {
        expect(explainAdd(q, true), mode).not.toBe(explainAdd(q, false));
      }
    }
  });

  it("names the size of the pieces where the pieces had to change", () => {
    for (const q of questions("refute", 10)) {
      expect(explainAdd(q, true)).toMatch(/sixths|quarters|eighths|tenths|twelfths|halves|thirds|fifths/);
    }
  });
});

describe("hints climb, and stop short of the answer", () => {
  it("never prints the answer in a hint", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 60)) {
        for (const hint of addHints(q)) {
          // Whole words: "12 works for these" is not giving away an answer of
          // "1", and a substring test says it is.
          const written = new RegExp(`(^|[^\\d/])${q.expected.replace("/", "\\/")}([^\\d/]|$)`);
          expect(written.test(hint), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });

  it("tells a child why the claim is wrong, not just that it is", () => {
    const [q] = questions("refute", 1);
    const hints = addHints(q);
    expect(hints).toHaveLength(3);
    expect(hints[2]).toMatch(/smaller/);
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(strip, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

describe("add_nested — only one strip needs cutting", () => {
  it("always draws one denominator that divides the other", () => {
    for (const q of questions("add_nested", 150)) {
      const [a, b] = [q.left.parts, q.right.parts];
      expect(a % b === 0 || b % a === 0, q.prompt).toBe(true);
      expect(a).not.toBe(b);
      expect(q.common).toBe(Math.max(a, b));
    }
  });

  it("asks the child to cut before it will take an answer", () => {
    for (const q of questions("add_nested", 40)) {
      expect(q.mustMatch, q.prompt).toBe(true);
      expect(addBlockedBecause(q, false)).toBe("pieces-differ");
    }
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "add_nested", partsRange: [2, 6] } },
      questions: 5,
    });
  });
});

describe("add_unlike and subtract_unlike — both strips need cutting", () => {
  it("never quietly draws the same denominator twice", () => {
    // The fallback used to be `[a, a]` when nothing paired under the ceiling,
    // which turned a lesson about matching into a lesson about counting.
    for (const mode of ["add_unlike", "subtract_unlike"] as AddMode[]) {
      for (const q of questions(mode, 200)) {
        expect(q.left.parts, `${mode}: ${q.prompt}`).not.toBe(q.right.parts);
        expect(q.mustMatch).toBe(true);
      }
    }
  });

  it("holds the drawing inside the ceiling even at the widest range", () => {
    for (const mode of ["add_unlike", "subtract_unlike"] as AddMode[]) {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i += 1) {
        const q = buildAddQuestion({ mode, partsRange: [2, 12] }, mode, i, seen);
        expect(q.common, `${mode}: ${q.prompt}`).toBeLessThanOrEqual(MAX_COMMON);
        expect(q.left.parts).not.toBe(q.right.parts);
      }
    }
  });

  it("says so rather than drawing something impossible", () => {
    // Sevenths and elevenths pair with nothing under twenty-four parts. A
    // lesson that asked for them would otherwise draw a like pair and teach the
    // wrong thing quietly.
    expect(() => buildAddQuestion({ mode: "add_unlike", partsRange: [7, 7] }, "add_unlike", 0)).toThrow(
      /no two denominators/,
    );
  });

  it("keeps adding inside one whole, where re-cutting is the new thing", () => {
    for (const q of questions("add_unlike", 120)) {
      expect(trueTotal(q), q.prompt).toBeLessThanOrEqual(1);
    }
  });

  /*
   * One mounted activity per test, always.
   *
   * These two rounds were one test, and the first harness was still mounted
   * while the second ran: `screen` is global, so every query saw ten answer
   * buttons and two of everything else, and a press landed on whichever mount
   * came first in the document. It failed about one run in four, which is the
   * worst kind of test — the failure was real, the cause was the test.
   */
  it("runs a full round of adding", async () => {
    const h = await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "add_unlike", partsRange: [2, 6] } },
      questions: 5,
    });
    h.unmount();
  });

  it("runs a full round of taking away", async () => {
    const h = await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "subtract_unlike", partsRange: [2, 6] } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("add_mixed — wholes and parts", () => {
  it("always gives both numbers a whole one", () => {
    for (const q of questions("add_mixed", 120)) {
      expect(q.leftOnes, q.prompt).toBeGreaterThanOrEqual(1);
      expect(q.rightOnes).toBeGreaterThanOrEqual(1);
    }
  });

  it("writes the answer as wholes and parts, not as one big fraction", () => {
    for (const q of questions("add_mixed", 120)) {
      expect(q.expected, q.prompt).toMatch(/^\d+( \d+\/\d+)?$/);
      expect(q.answer.ones).toBeGreaterThanOrEqual(2);
    }
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "add_mixed", partsRange: [2, 6], onesRange: [1, 2] } },
      questions: 5,
    });
  });
});

describe("subtract_mixed — a whole one always has to break", () => {
  it("never has enough loose parts to take away without breaking one", () => {
    // This is the technique. A draw that happens not to need the exchange is a
    // question about the level before this one.
    for (const q of questions("subtract_mixed", 200)) {
      const m = matchedPair(q);
      expect(m.left.taken, q.prompt).toBeLessThan(m.right.taken);
    }
  });

  it("always has a whole one standing in front to break", () => {
    for (const q of questions("subtract_mixed", 200)) {
      expect(q.leftOnes, q.prompt).toBeGreaterThan(q.rightOnes);
      expect(q.leftOnes).toBeGreaterThanOrEqual(1);
    }
  });

  it("leaves a real amount behind", () => {
    for (const q of questions("subtract_mixed", 200)) {
      expect(trueTotal(q), q.prompt).toBeGreaterThan(0);
      expect(textValue(q.expected)).toBeCloseTo(trueTotal(q), 10);
    }
  });

  it("runs a full round", async () => {
    await expectStandardRound(strip, answerRight, {
      params: { question: { mode: "subtract_mixed", partsRange: [2, 6], onesRange: [1, 3] } },
      questions: 5,
    });
  });
});

describe("the same number in either name is the same answer", () => {
  it("accepts the improper form where the mixed one is asked for", () => {
    /*
     * `4/7 + 5/7` is `9/7` and `1 2/7`. Both appeared as buttons — the dedup
     * compared decimals, and 1.2857142857142858 is not 1.2857142857142856 — and
     * the child who pressed the improper one was marked wrong for using the
     * other name the skill had just taught them.
     */
    for (const q of questions("add_like", 40)) {
      expect(isAddCorrect(q, q.expected)).toBe(true);
      // The same amount over the question's own denominator: "1 2/7" as "9/7",
      // and a whole "1" as "5/5", which is the other name for one whole.
      const [ones, frac] = q.expected.includes(" ") ? q.expected.split(" ") : ["0", q.expected];
      const bottom = frac.includes("/") ? Number(frac.split("/")[1]) : q.common;
      const top = frac.includes("/") ? Number(frac.split("/")[0]) : Number(frac) * bottom;
      const improper = `${Number(ones) * bottom + top}/${bottom}`;
      expect(isAddCorrect(q, improper), `${q.prompt} = ${q.expected}, rejected ${improper}`).toBe(true);
    }
  });

  it("never puts two spellings of one amount on the buttons", () => {
    for (const mode of LIVE) {
      for (const q of questions(mode, 120)) {
        const amounts = (q.options ?? []).map(textValue);
        for (let i = 0; i < amounts.length; i += 1) {
          for (let j = i + 1; j < amounts.length; j += 1) {
            expect(
              Math.abs(amounts[i] - amounts[j]),
              `${mode}: ${q.prompt} offers ${q.options?.[i]} and ${q.options?.[j]}`,
            ).toBeGreaterThan(1e-9);
          }
        }
      }
    }
  });

  it("still refuses an answer that is a different amount", () => {
    for (const q of questions("add_like", 40)) {
      const wrong = (q.options ?? []).filter((o) => Math.abs(textValue(o) - textValue(q.expected)) > 1e-9);
      for (const option of wrong) expect(isAddCorrect(q, option), `${q.prompt}: ${option}`).toBe(false);
    }
  });
});
