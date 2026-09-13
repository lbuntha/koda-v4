import { describe, expect, it } from "vitest";

import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  buildStoryQuestion,
  explainStory,
  isStoryCorrect,
  type StoryMode,
  type StoryQuestion,
} from "./internal/data/fractionStory";
import { storyHints } from "./activities/StoryBoard";

/**
 * Word problems, checked for the thing word problems get wrong.
 *
 * Not the arithmetic — that is the easy half — but whether the named trap is
 * actually on the buttons. A comparison question without the subtractive answer
 * offered is a question a child passes by elimination, and it teaches nothing
 * about which operation the words were asking for.
 */

const board = skill.activities.story;

const MODES: StoryMode[] = [
  "of_amount",
  "share_leftover",
  "add_context",
  "scale",
  "compare_context",
  "multi_step",
];

const questions = (mode: StoryMode, n = 200): StoryQuestion[] => {
  const seen = new Set<string>();
  return Array.from({ length: n }, (_, i) => buildStoryQuestion({ mode }, mode, i, seen));
};

const textValue = (text: string): number => {
  const [ones, frac] = text.includes(" ") ? text.split(" ") : ["0", text];
  if (!frac.includes("/")) return Number(ones) + Number(frac);
  const [top, bottom] = frac.split("/").map(Number);
  return Number(ones) + top / bottom;
};

/**
 * Read the story, work it out, press the button.
 *
 * The answer buttons are found inside their own row rather than by text: the
 * bar cutters are numbered 2 to 8, so "press the button that says 6" hit a
 * cutter on every question whose answer was a small number.
 */
const answerRight = async (h: ActivityHarness): Promise<void> => {
  const wanted = expectedFromStory(h.text());
  const row = h.within(h.screen.getByTestId("answers"));
  const buttons = row.getAllByRole("button");
  const right = buttons.find(
    (b) => Math.abs(textValue((b.textContent ?? "").trim()) - wanted) < 1e-9,
  );
  expect(
    right,
    `nothing is worth ${wanted} — offered ${buttons.map((b) => b.textContent).join(", ")} for: ${h.text().slice(40, 260)}`,
  ).toBeTruthy();
  const before = h.koda.count("learning.answered");
  (right as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await h.settle();
  expect(h.koda.count("learning.answered")).toBe(before + 1);
  const [last] = h.koda.only("learning.answered").slice(-1);
  expect(
    (last.args[0] as { correct: boolean }).correct,
    `"${right?.textContent}" was marked wrong — screen: ${h.text().slice(40, 260)}`,
  ).toBe(true);
};

/** What the story on screen comes to, read the way a child reads it. */
function expectedFromStory(text: string): number {
  const ofAmount = /has (\d+) \w+ and gives away (\d+)\/(\d+) of them/.exec(text);
  if (ofAmount) return (Number(ofAmount[1]) / Number(ofAmount[3])) * Number(ofAmount[2]);
  const shared = /(\d+) \w+ are shared equally between (\d+) people/.exec(text);
  if (shared) return Number(shared[1]) / Number(shared[2]);
  const adding = /drinks (\d+)\/(\d+) of a bottle[^]*?drinks (\d+)\/(\d+) of it/.exec(text);
  if (adding) return Number(adding[1]) / Number(adding[2]) + Number(adding[3]) / Number(adding[4]);
  const recipe = /needs (\d+) (\d+)\/(\d+) cups[^]*?making (\d+) times/.exec(text);
  if (recipe) {
    const each = Number(recipe[1]) + Number(recipe[2]) / Number(recipe[3]);
    return each * Number(recipe[4]);
  }
  const compare = /fills (\d+)\/(\d+) of a box[^]*?fills (\d+)\/(\d+) of an identical box/.exec(text);
  if (compare) return Number(compare[1]) / Number(compare[2]) / (Number(compare[3]) / Number(compare[4]));
  const twoStep = /has (\d+) \w+ and gives (\d+)\/(\d+) of them[^]*?finds (\d+) more/.exec(text);
  if (twoStep) {
    const total = Number(twoStep[1]);
    const given = (total / Number(twoStep[3])) * Number(twoStep[2]);
    return total - given + Number(twoStep[4]);
  }
  return NaN;
}

describe("every story is a question, and every question has an answer", () => {
  it("reads as English and ends with a question mark", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 120)) {
        expect(q.story, mode).not.toMatch(/undefined|NaN/);
        expect(q.story.trim()).toMatch(/\?$/);
        expect(q.story.split(/\s+/).length).toBeGreaterThan(8);
      }
    }
  });

  it("offers its own answer and nothing else worth the same", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 120)) {
        expect(q.options, `${mode}: ${q.story}`).toContain(q.expected);
        const equal = q.options.filter((o) => Math.abs(textValue(o) - textValue(q.expected)) < 1e-9);
        expect(equal.length, `${mode}: ${q.story} -> ${q.options.join(", ")}`).toBe(1);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("tells the bar how to be drawn", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 80)) {
        expect(q.parts, `${mode}: ${q.story}`).toBeGreaterThanOrEqual(2);
        expect(q.shaded).toBeGreaterThanOrEqual(1);
        expect(q.unit).toBeTruthy();
      }
    }
  });
});

describe("of_amount — a fraction of a quantity", () => {
  it("only draws amounts that share out exactly", () => {
    for (const q of questions("of_amount", 200)) {
      expect(q.whole % q.parts, q.story).toBe(0);
      expect(Number(q.expected)).toBe((q.whole / q.parts) * q.shaded);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "of_amount", totalMax: 60 } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("share_leftover — where the remainder becomes the answer", () => {
  it("always leaves something over to cut up", () => {
    // A question that divides exactly is the division lesson, not this one.
    for (const q of questions("share_leftover", 200)) {
      expect(q.whole % q.parts, q.story).not.toBe(0);
      expect(q.expected).toMatch(/^\d+ \d+\/\d+$/);
    }
  });

  it("offers 'one each and one left over', because that is what a child says", () => {
    for (const q of questions("share_leftover", 120)) {
      const wholeOnly = String(Math.floor(q.whole / q.parts));
      expect(q.options, q.story).toContain(wholeOnly);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "share_leftover" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("add_context — two parts of the same bottle", () => {
  it("always gives them different-sized pieces", () => {
    for (const q of questions("add_context", 150)) {
      const pieces = /(\d+)\/(\d+) of a bottle[^]*?(\d+)\/(\d+) of it/.exec(q.story);
      expect(pieces, q.story).toBeTruthy();
      expect(pieces![2]).not.toBe(pieces![4]);
    }
  });

  it("offers the added-bottoms answer, which is what this whole skill is against", () => {
    for (const q of questions("add_context", 120)) {
      const pieces = /(\d+)\/(\d+) of a bottle[^]*?(\d+)\/(\d+) of it/.exec(q.story)!;
      const wrong = `2/${Number(pieces[2]) + Number(pieces[4])}`;
      expect(q.options, q.story).toContain(wrong);
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "add_context" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("scale — a recipe made several times over", () => {
  it("multiplies the whole cups and the parts together", () => {
    for (const q of questions("scale", 150)) {
      const read = /needs (\d+) (\d+)\/(\d+) cups[^]*?making (\d+) times/.exec(q.story);
      expect(read, q.story).toBeTruthy();
      const each = Number(read![1]) + Number(read![2]) / Number(read![3]);
      expect(textValue(q.expected)).toBeCloseTo(each * Number(read![4]), 10);
    }
  });

  it("offers the answer with the fraction left behind", () => {
    const lazy = questions("scale", 120).filter((q) => {
      const read = /needs (\d+) (\d+)\/(\d+) cups[^]*?making (\d+) times/.exec(q.story)!;
      return q.options.includes(`${Number(read[1]) * Number(read[4])} ${read[2]}/${read[3]}`);
    });
    expect(lazy.length).toBeGreaterThan(60);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "scale" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("compare_context — how many times, not how much more", () => {
  it("answers with a whole number of times", () => {
    for (const q of questions("compare_context", 200)) {
      expect(Number.isInteger(Number(q.expected)), q.story).toBe(true);
      expect(Number(q.expected)).toBeGreaterThanOrEqual(2);
    }
  });

  it("offers the difference, which is the answer two years of subtraction suggest", () => {
    const compares = questions("compare_context", 150);
    const withTrap = compares.filter((q) => q.options.some((o) => o.includes("/")));
    expect(withTrap.length / compares.length).toBeGreaterThan(0.9);
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "compare_context" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("multi_step — where the first answer is not the answer", () => {
  it("keeps the halfway number off the buttons as a trap, not as the answer", () => {
    for (const q of questions("multi_step", 150)) {
      const read = /has (\d+) \w+ and gives (\d+)\/(\d+) of them[^]*?finds (\d+) more/.exec(q.story)!;
      const total = Number(read[1]);
      const left = total - (total / Number(read[3])) * Number(read[2]);
      expect(q.options, q.story).toContain(String(left));
      expect(Number(q.expected)).toBe(left + Number(read[4]));
    }
  });

  it("runs a full round", async () => {
    const h = await expectStandardRound(board, answerRight, {
      params: { question: { mode: "multi_step" } },
      questions: 5,
    });
    h.unmount();
  });
});

describe("the bar is cut by the child, and can be put back", () => {
  it("starts whole and takes a cut", async () => {
    const h = renderActivity(board, { params: { question: { mode: "of_amount" } } });
    expect(h.screen.getByTestId("bar").textContent).toContain("the whole thing");
    expect(h.buttons()).not.toContain("Start over");
    await h.press("4");
    expect(h.screen.getByTestId("bar").textContent).toContain("4 equal parts");
    expect(h.buttons()).toContain("Start over");
    await h.press("Start over");
    expect(h.screen.getByTestId("bar").textContent).toContain("the whole thing");
    h.unmount();
  });

  it("does not read the story as a row of buttons", () => {
    // Division's story level shipped with the paragraph looking tappable.
    const h = renderActivity(board, { params: { question: { mode: "of_amount" } } });
    const story = h.text();
    expect(h.buttons().some((b) => story.startsWith(b) && b.length > 20)).toBe(false);
    h.unmount();
  });
});

describe("what the child is told afterwards", () => {
  it("explains the method, not the verdict", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 30)) {
        for (const correct of [true, false]) {
          const text = explainStory(q, correct);
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
        expect(explainStory(q, true), mode).not.toBe(explainStory(q, false));
      }
    }
  });
});

describe("hints name the decision, not the sum", () => {
  it("never prints the answer in a hint", () => {
    for (const mode of MODES) {
      for (const q of questions(mode, 60)) {
        for (const hint of storyHints(q)) {
          const written = new RegExp(`(^|[^\\d/])${q.expected.replace("/", "\\/")}([^\\d/]|$)`);
          expect(written.test(hint), `${mode}: "${hint}" hands over ${q.expected}`).toBe(false);
        }
      }
    }
  });

  it("accepts either name for an amount", () => {
    for (const q of questions("share_leftover", 60)) {
      const [ones, frac] = q.expected.split(" ");
      const [top, bottom] = frac.split("/").map(Number);
      const improper = `${Number(ones) * bottom + top}/${bottom}`;
      expect(isStoryCorrect(q, improper), `${q.story} = ${q.expected}, rejected ${improper}`).toBe(true);
    }
  });
});

describe("a skill for readers", () => {
  it("says nothing when a round opens", () => {
    const h = renderActivity(board, { features: { audio_speech: true } });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});
