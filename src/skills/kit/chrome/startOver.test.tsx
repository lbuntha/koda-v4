import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { renderActivity } from "../testing";
import { skill as addition } from "../../addition";

/**
 * "There is no undo or start over button if the answer is wrong."
 *
 * Reported from a real session, and true of every engine in the app at the
 * time. A wrong answer keeps the child on the same question — which is right,
 * and is what makes "right on the second try" different from "right first
 * time" — but it also left the board exactly as they had built it, with no way
 * back except undoing each move by hand. A stuck eight-year-old does not do
 * that; they press the same wrong answer again.
 *
 * `SkillRound` takes `onStartOver` and draws one quiet control under the work.
 * These tests hold two things: that the control does what it says, and that no
 * engine holding a child's work forgets to offer it.
 */

describe("the control puts the work back", () => {
  it("appears once there is something to clear, and clears it", async () => {
    const h = renderActivity(addition.activities.base10);
    expect(h.buttons(), "offered before anything was built").not.toContain("Start over");

    await h.press("Add a ten rod");
    expect(h.buttons(), "not offered after a rod was added").toContain("Start over");

    await h.press("Start over");
    expect(h.buttons(), "still offered after clearing the yard").not.toContain("Start over");
    h.unmount();
  });

  it("clears the whole of it, not the last move", async () => {
    // Undo is a different control and some engines have both. This one puts
    // everything back at once, which is what a stuck child needs.
    const h = renderActivity(addition.activities.base10);
    await h.press("Add a ten rod");
    await h.press("Add a ten rod");
    await h.press("Add a one unit");
    await h.press("Start over");
    expect(h.buttons()).not.toContain("Start over");
    h.unmount();
  });

  it("does not answer the question for the child", async () => {
    // Starting over is not an attempt. It must not reach the log, or a child
    // who tidies up looks like a child who got it wrong.
    const h = renderActivity(addition.activities.base10);
    await h.press("Add a one unit");
    const before = h.koda.count("learning.answered");
    await h.press("Start over");
    expect(h.koda.count("learning.answered")).toBe(before);
    h.unmount();
  });
});

/**
 * Which engines owe a child a way back.
 *
 * Anything that holds what the child has built: blocks placed, digits typed,
 * counters tapped, a bar cut. The exemptions are the engines whose entire state
 * is one choice or one timer — pressing a different button *is* starting over
 * there, and a second control would be one more thing to read.
 */
const CHOICE_ONLY = new Set([
  "addition/StrategyPicker",
  "subtraction/BondHouse",
  "subtraction/EstimateDial",
  "subtraction/StrategyPicker",
  "multiplication/StoryBoard",
  "multiplication/StrategyPicker",
  "counting/SubitizingRush",
  "fractions/StrategyPicker",
  "fractions/DecimalBridge",
  "division/ArrayDivide",
  "division/EstimateDial",
  "division/RemainderYard",
  "division/StoryBoard",
  "division/StrategyPicker",
]);

/** State that belongs to the round's plumbing, not to the child's work. */
const PLUMBING = /^(nextStep|refused|nudge|phase|timer|flash|celebrating|finishing|announcement)$/;

describe("no engine holding a child's work forgets the way back", () => {
  const skills = ["counting", "addition", "subtraction", "multiplication", "division", "fractions"];

  for (const id of skills) {
    it(`offers it everywhere it is owed in ${id}`, () => {
      const dir = join(process.cwd(), `src/skills/${id}/activities`);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
        const text = readFileSync(join(dir, file), "utf8");
        const name = `${id}/${file.replace(".tsx", "")}`;
        const holds = [...text.matchAll(/const \[(\w+), set\w+\] = useState/g)]
          .map((m) => m[1])
          .filter((v) => !PLUMBING.test(v));
        if (holds.length === 0 || CHOICE_ONLY.has(name)) continue;
        expect(
          text.includes("onStartOver"),
          `${name} holds ${holds.join(", ")} and offers no way back`,
        ).toBe(true);
      }
    });
  }

  it("keeps the exemption list honest", () => {
    // An engine listed here that has since grown state is an engine quietly
    // exempt from a rule it now breaks.
    for (const name of CHOICE_ONLY) {
      const [id, file] = name.split("/");
      const text = readFileSync(join(process.cwd(), `src/skills/${id}/activities/${file}.tsx`), "utf8");
      const holds = [...text.matchAll(/const \[(\w+), set\w+\] = useState/g)]
        .map((m) => m[1])
        .filter((v) => !PLUMBING.test(v));
      expect(holds.length, `${name} now holds ${holds.join(", ")}`).toBeLessThanOrEqual(3);
    }
  });
});
