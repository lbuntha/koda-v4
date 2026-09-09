import { describe, expect, it } from "vitest";
import { renderActivity, expectStandardRound, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, sentenceFor, type StoryMode } from "./activities/StoryBoard";
import { ACTORS, castFor } from "./internal/data/storyCast";
import { drawMultiplicationStory } from "./internal/data/multiplicationNumbers";

/**
 * StoryBoard, driven the way a child drives it.
 *
 * Every answer is computed here from the numbers in the sentence, which is the
 * only honest way to test a word problem: an engine that told the driver its
 * answer would be marking its own homework twice over.
 */

const story = skill.activities.story;

const ALL_MODES: StoryMode[] = [
  "equal_groups_total", "groups_unknown", "size_unknown",
  "times_as_many", "rate", "multi_step",
];

const render = (mode: StoryMode, params: Record<string, unknown> = {}) =>
  renderActivity(story, { params: { mode, questionsPerRound: 5, ...params } });

/** Read the sentence and work the answer out from it. */
const solve = (mode: StoryMode, text: string): number => {
  switch (mode) {
    case "groups_unknown": {
      const [, total, each] = /has (\d+) [a-z]+, packed (\d+) to a/.exec(text)!;
      return Number(total) / Number(each);
    }
    case "size_unknown": {
      const [, total, groups] = /shares (\d+) [a-z]+ equally between (\d+)/.exec(text)!;
      return Number(total) / Number(groups);
    }
    case "times_as_many": {
      const [, base] = /has (\d+) [a-z]+\./.exec(text)!;
      const [, times] = /has (\d+) times as many/.exec(text)!;
      return Number(base) * Number(times);
    }
    case "rate": {
      const [, per, many] = /One [a-z]+ holds (\d+) [a-z]+\. How many [a-z]+ are in (\d+)/.exec(text)!;
      return Number(per) * Number(many);
    }
    case "multi_step": {
      const [, groups, each] = /has (\d+) [a-z]+ with (\d+) [a-z]+ in each/.exec(text)!;
      const gives = /gives (\d+) away/.exec(text);
      const finds = /finds (\d+) more/.exec(text);
      const base = Number(groups) * Number(each);
      return gives ? base - Number(gives[1]) : base + Number(finds![1]);
    }
    case "equal_groups_total":
    default: {
      const [, groups, each] = /has (\d+) [a-z]+ of [a-z]+, with (\d+) in each/.exec(text)!;
      return Number(groups) * Number(each);
    }
  }
};

const driverFor = (mode: StoryMode) => async (h: ActivityHarness) => {
  if (mode === "multi_step") await h.press(/^Work out \d+ times \d+ first$/);
  await h.press(`${solve(mode, h.text())}`);
};

describe("every story mode plays a complete round", () => {
  for (const mode of ALL_MODES) {
    it(`${mode} finishes a clean round`, async () => {
      const h = await expectStandardRound(story, driverFor(mode), { params: { mode }, questions: 5 });
      h.unmount();
    });
  }
});

/* -------------------------------------------------------------------------- */
/* The arithmetic behind the words                                             */
/* -------------------------------------------------------------------------- */

describe("the numbers behave the way the sentence claims", () => {
  it("gives every mode an answer its own sentence supports", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 120; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(solve(mode, question.prompt!), `${mode}: ${question.prompt}`).toBe(question.answer);
        expect(question.choices).toContain(question.answer);
        expect(new Set(question.choices).size).toBe(4);
        for (const choice of question.choices) expect(choice).toBeGreaterThan(0);
      }
    }
  });

  it("shares out exactly, so an unknown factor is always whole", () => {
    for (const mode of ["groups_unknown", "size_unknown"] as StoryMode[]) {
      for (let i = 0; i < 200; i += 1) {
        const question = buildQuestion({ mode }, i);
        // Generated from the factors, never by dividing a total.
        expect(Number.isInteger(question.answer)).toBe(true);
        expect(question.values[0] % question.answer).toBe(0);
      }
    }
  });

  /*
   * And it never takes everything away.
   *
   * "Twelve, gives twelve away, how many now?" answers zero — true, and a poor
   * question: nothing is left to have been multiplied, and every wrong answer
   * beside it has to be bigger than the right one.
   */
  it("leaves something behind at every stage of a two-step story", () => {
    for (let i = 0; i < 400; i += 1) {
      const question = buildQuestion({ mode: "multi_step" }, i);
      expect(question.intermediate).toBe(question.values[0] * question.values[1]);
      expect(question.answer).toBeGreaterThan(0);
      for (const step of question.steps ?? []) expect(step.result).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* §12 trap 15                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * "Four times as many" read as "four more".
 *
 * The confusion level 53 exists to correct. A round that never offers the
 * additive answer has not tested it, however many questions it asked — so it is
 * a choice every single time, and choosing it gets its own words rather than a
 * generic "not quite".
 */
describe("a comparison always offers the additive misreading", () => {
  it("puts the additive answer among the choices every time", () => {
    for (let i = 0; i < 300; i += 1) {
      const question = buildQuestion({ mode: "times_as_many" }, i);
      const [base, times] = question.values;
      expect(question.additiveAnswer).toBe(base + times);
      expect(question.choices, `${base} × ${times}`).toContain(base + times);
      // And the two readings never coincide, or the trap would score as right.
      expect(question.answer).not.toBe(question.additiveAnswer);
    }
  });

  it("names the mistake instead of only marking it", async () => {
    const h = render("times_as_many");
    const [, base] = /has (\d+) [a-z]+\./.exec(h.text())!;
    const [, times] = /has (\d+) times as many/.exec(h.text())!;
    await h.press(`${Number(base) + Number(times)}`);
    const [report] = h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });
    expect(report.correct).toBe(false);
    expect(h.text()).toMatch(/Times, not more/);
    expect(h.text()).toMatch(
      new RegExp(`${times} more than ${base} would be ${Number(base) + Number(times)}`),
    );
    h.unmount();
  });

  it("draws two bars, the second a whole number of copies of the first", async () => {
    const h = render("times_as_many");
    const [, times] = /has (\d+) times as many/.exec(h.text())!;
    const bars = h.screen
      .getAllByRole("img")
      .map((el) => el.getAttribute("aria-label") ?? "")
      .filter((l) => /bars? of \d+$/.test(l));
    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatch(/has one bar of \d+$/);
    expect(bars[1]).toMatch(new RegExp(`has ${times} bars of \\d+$`));
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* The cast                                                                    */
/* -------------------------------------------------------------------------- */

describe("the cast is fixed, and steady within a question", () => {
  it("gives the same question the same people every time it is asked", () => {
    for (const seed of ["story-rate-0-3x4", "story-times_as_many-2-5x3"]) {
      const first = castFor(seed);
      for (let i = 0; i < 20; i += 1) expect(castFor(seed)).toEqual(first);
    }
  });

  it("never makes a comparison between someone and themselves", () => {
    for (let i = 0; i < 400; i += 1) {
      const cast = castFor(`story-times_as_many-${i}`);
      expect(cast.actor).not.toBe(cast.other);
      expect(ACTORS).toContain(cast.actor);
      expect(ACTORS).toContain(cast.other);
    }
  });

  /*
   * No pronouns anywhere.
   *
   * A name carries no reliable information about how a person should be
   * referred to, and every sentence here can be written without guessing.
   */
  it("writes every sentence without a pronoun", () => {
    const pronouns = /\b(he|she|him|her|his|hers)\b/i;
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 60; i += 1) {
        const question = buildQuestion({ mode }, i);
        expect(question.prompt, `${mode}: ${question.prompt}`).not.toMatch(pronouns);
        expect(story.worksheet!.method!(question)!.join(" ")).not.toMatch(pronouns);
      }
    }
  });

  it("agrees its numbers with its nouns", () => {
    const cast = castFor("fixed");
    const one = sentenceFor("rate", [1, 4], cast);
    expect(one).toContain(`1 ${cast.item.one}`);
    expect(one).not.toContain(`1 ${cast.item.many}`);
  });
});

/* -------------------------------------------------------------------------- */
/* Two steps                                                                   */
/* -------------------------------------------------------------------------- */

describe("a two-step story does the multiplication first", () => {
  it("offers the first step as a support, and scores nothing for it", async () => {
    const h = render("multi_step");
    const [, groups, each] = /has (\d+) [a-z]+ with (\d+) [a-z]+ in each/.exec(h.text())!;
    await h.press(`Work out ${groups} times ${each} first`);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.koda.count("learning.supportUsed")).toBe(1);
    expect(h.text()).toContain(`${groups} × ${each} = ${Number(groups) * Number(each)}`);
    h.unmount();
  });

  it("explains both steps when the answer is wrong", async () => {
    const h = render("multi_step");
    const right = solve("multi_step", h.text());
    const wrong = h.buttons().find((l) => /^\d+$/.test(l) && Number(l) !== right)!;
    await h.press(wrong);
    expect(h.text()).toMatch(/× \d+ = \d+, then (add|take away) \d+ to get \d+/);
    h.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

describe("the worksheet prints all six modes", () => {
  it("prints the story whole, with a bar to work it on", () => {
    for (const mode of ALL_MODES) {
      for (let i = 0; i < 20; i += 1) {
        const question = buildQuestion({ mode }, i);
        const printed = story.worksheet!.printed!(question);
        expect(printed, `${mode} prints nothing`).toBeTruthy();
        // A word problem prints as itself: the sentence is the question.
        expect(printed!.text).toContain(question.prompt!);
        expect(printed!.answer).toBe(String(question.answer));
        expect(story.worksheet!.method!(question)!.length).toBeGreaterThan(1);
        expect(story.worksheet!.figure!(question)).toBeTruthy();
      }
    }
  });

  it("says on paper that times as many is not more than", () => {
    const question = buildQuestion({ mode: "times_as_many" }, 0);
    expect(story.worksheet!.method!(question)!.join(" ")).toMatch(/not \d+ more than/);
  });
});

/* -------------------------------------------------------------------------- */

describe("the generator refuses a comparison it cannot tell apart", () => {
  it("throws when every pair reads the same either way", () => {
    // 2 × 2 and 2 + 2 are both four: the one pair where the misreading scores.
    expect(() => drawMultiplicationStory("times_as_many", {
      smallerRange: [2, 2], multiplierRange: [2, 2],
    })).toThrow(/reads the same either way/);
  });
});
