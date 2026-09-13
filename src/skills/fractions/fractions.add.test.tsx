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

const LIVE: AddMode[] = ["add_like", "subtract_like", "refute"];

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
  const sum = /Somebody says (.+?) = /.exec(h.text())
    ? promptValue((/Somebody says (.+?) = /.exec(h.text()) as string[])[1])
    : promptValue((/([\d /]+[+−][\d /]+)/.exec(h.text()) as string[])?.[1] ?? "");
  const right = h
    .buttons()
    .filter((b) => /^\d/.test(b))
    .find((b) => Math.abs(textValue(b) - sum) < 1e-9);
  expect(right, `no button is worth ${sum} — options were ${h.buttons().join(", ")}`).toBeTruthy();
  await h.press(right as string);
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

  it("never goes below zero", () => {
    for (const q of questions("subtract_like", 200)) {
      expect(trueTotal(q), q.prompt).toBeGreaterThan(0);
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
          expect(hint, `${mode}: "${hint}"`).not.toContain(q.expected);
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
