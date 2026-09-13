import { describe, expect, it } from "vitest";

import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildStrip } from "./activities/FoldStrip";
import { buildQuestion as buildLine } from "./activities/FractionLine";
import { buildQuestion as buildMill } from "./activities/EquivalenceMill";
import { buildQuestion as buildCompare } from "./activities/CompareBar";
import { buildQuestion as buildMixed } from "./activities/MixedBoard";
import { buildQuestion as buildAdd } from "./activities/AddStrip";
import { buildQuestion as buildMultiply } from "./activities/AreaGrid";
import { buildQuestion as buildDivide } from "./activities/ShareOut";
import { buildQuestion as buildDecimal } from "./activities/DecimalBridge";
import { buildQuestion as buildEstimate } from "./activities/EstimateDial";
import { buildQuestion as buildStory } from "./activities/StoryBoard";

/**
 * Practice: the same engines with the scaffolding taken away.
 *
 * Two things have to hold for every practice lesson, and both fail silently.
 * The modes must be *cycled* rather than sampled, or an eight-question round
 * can miss a technique entirely and still look mixed. And the help must be gone
 * — all of it, not most of it: a hint button with nothing behind it teaches a
 * child that the app's controls are decorative.
 */

const practiceLessons = skill.lessons.filter(
  (l) => (l.params as { question?: { practice?: boolean } })?.question?.practice === true,
);

describe("every engine gets a practice lesson", () => {
  it("has one per activity, and no activity without one", () => {
    const activities = Object.keys(skill.activities).sort();
    const practised = practiceLessons.map((l) => l.activity.split("/")[1]).sort();
    expect(practised).toEqual(activities);
    expect(practiceLessons).toHaveLength(12);
  });

  it("puts them in a contiguous block after the teaching levels", () => {
    const levels = practiceLessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual([58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
  });

  it("names only modes its engine actually has, and each of them once", () => {
    for (const lesson of practiceLessons) {
      const question = (lesson.params as { question: { modes?: string[] } }).question;
      if (!question.modes) continue;
      expect(new Set(question.modes).size, lesson.id).toBe(question.modes.length);
    }
  });

  it("asks enough questions to reach every mode it names", () => {
    for (const lesson of practiceLessons) {
      const question = (lesson.params as { question: { modes?: string[]; questionsPerRound: number } }).question;
      if (!question.modes) continue;
      expect(question.questionsPerRound, lesson.id).toBeGreaterThanOrEqual(question.modes.length);
    }
  });
});

describe("modes are cycled, never sampled", () => {
  const cases: [string, (p: Record<string, unknown>, i: number, s?: Set<string>) => { mode?: string }][] = [
    ["strip", buildStrip as never],
    ["numberline", buildLine as never],
    ["equivalence", buildMill as never],
    ["compare", buildCompare as never],
    ["mixed", buildMixed as never],
    ["add", buildAdd as never],
    ["multiply", buildMultiply as never],
    ["divide", buildDivide as never],
    ["decimal", buildDecimal as never],
    ["estimate", buildEstimate as never],
    ["story", buildStory as never],
  ];

  for (const [activity, build] of cases) {
    it(`covers every mode of ${activity} within one round`, () => {
      const lesson = practiceLessons.find((l) => l.activity === `fractions/${activity}`);
      if (!lesson) throw new Error(`no practice lesson for ${activity}`);
      const question = (lesson.params as { question: { modes: string[]; questionsPerRound: number } }).question;
      const seen = new Set<string>();
      const modes = Array.from({ length: question.questionsPerRound }, (_, i) =>
        build({ question }, i, seen),
      ).map((q) => q.mode);
      // Cycled: question n uses mode n, wrapping. Every mode appears.
      expect(new Set(modes).size, `${activity}: ${modes.join(", ")}`).toBe(question.modes.length);
      expect(modes.slice(0, question.modes.length)).toEqual(question.modes);
    });
  }
});

describe("the help is gone, and gone completely", () => {
  for (const activity of Object.keys(skill.activities)) {
    it(`offers no hint and no read-aloud in ${activity} practice`, () => {
      const lesson = practiceLessons.find((l) => l.activity === `fractions/${activity}`);
      if (!lesson) throw new Error(`no practice lesson for ${activity}`);
      const h = renderActivity(skill.activities[activity], {
        params: (lesson.params as { question: Record<string, unknown> }).question,
      });
      const buttons = h.buttons();
      expect(buttons.some((b) => /hint/i.test(b)), `${activity} offers a hint`).toBe(false);
      // Whole words: "the pieces already match" contains "read", and the
      // strategy level failed this on a route label rather than on a button
      // that speaks.
      expect(
        buttons.some((b) => /\b(read|listen|aloud|speak)\b/i.test(b)),
        `${activity} reads aloud`,
      ).toBe(false);
      h.unmount();
    });
  }

  it("drops the labels that name the technique as well", () => {
    // "both are sixths now" is a hint wearing a caption's clothes.
    const lesson = practiceLessons.find((l) => l.activity === "fractions/add");
    const h = renderActivity(skill.activities.add, {
      params: (lesson?.params as { question: Record<string, unknown> }).question,
    });
    expect(h.text()).not.toMatch(/both are \w+ now/);
    h.unmount();
  });

  it("says nothing at all when a practice round opens", () => {
    const lesson = practiceLessons.find((l) => l.activity === "fractions/strip");
    const h = renderActivity(skill.activities.strip, {
      params: (lesson?.params as { question: Record<string, unknown> }).question,
      features: { audio_speech: true },
    });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

describe("practice is titled as practice and scored as practice", () => {
  it("marks every one of them with the flag, not just the title", () => {
    for (const lesson of practiceLessons) {
      const question = (lesson.params as { question: { practice?: boolean } }).question;
      expect(question.practice, lesson.id).toBe(true);
      expect(lesson.title).toMatch(/^Practice: /);
      expect(lesson.concept).toBe("Practice Without Help");
    }
  });

  it("claims no standards, because practice teaches nothing new", () => {
    for (const lesson of practiceLessons) expect(lesson.standards).toEqual([]);
  });

  it("asks for a technique the child has already been taught", () => {
    const taught = new Set(skill.manifest.teaches);
    for (const lesson of practiceLessons) {
      expect(taught.has(lesson.conceptKey as string), `${lesson.id} practises ${lesson.conceptKey}`).toBe(true);
    }
  });
});
