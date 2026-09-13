import { describe, expect, it } from "vitest";

import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildShare } from "./activities/ShareTray";
import { buildQuestion as buildArray } from "./activities/ArrayDivide";
import { buildQuestion as buildLine } from "./activities/HopBack";
import { buildQuestion as buildFact } from "./activities/FactDeck";
import { buildQuestion as buildRemainder } from "./activities/RemainderYard";
import { buildQuestion as buildPlace } from "./activities/PlaceValueDesk";
import { buildQuestion as buildChunk } from "./activities/ChunkPad";
import { buildQuestion as buildColumn } from "./activities/DivisionPad";

/**
 * Practice: the same engines with the scaffolding taken away.
 *
 * Two things have to hold for every practice lesson, and both fail silently.
 * The modes must be *cycled* rather than sampled, or a nine-question round can
 * miss a technique entirely and still look mixed. And the help must be gone —
 * all of it, not most of it: a hint button with nothing behind it teaches a
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

  it("gives every practice lesson a contiguous level after the teaching ones", () => {
    const levels = practiceLessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual([57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68]);
  });

  it("names only modes its engine actually has", () => {
    for (const lesson of practiceLessons) {
      const question = (lesson.params as { question: { modes?: string[] } }).question;
      if (!question.modes) continue;
      expect(new Set(question.modes).size, lesson.id).toBe(question.modes.length);
    }
  });
});

describe("modes are cycled, never sampled", () => {
  const cases: [string, (p: Record<string, unknown>, i: number, s?: Set<string>) => { mode?: string }][] = [
    ["share", buildShare as never],
    ["array", buildArray as never],
    ["numberline", buildLine as never],
    ["facts", buildFact as never],
    ["remainder", buildRemainder as never],
    ["chart", buildPlace as never],
    ["chunk", buildChunk as never],
    ["column", buildColumn as never],
  ];

  for (const [activity, build] of cases) {
    it(`covers every mode of ${activity} within one round`, () => {
      const lesson = practiceLessons.find((l) => l.activity === `division/${activity}`);
      if (!lesson) throw new Error(`no practice lesson for ${activity}`);
      const question = (lesson.params as { question: { modes: string[]; questionsPerRound: number } }).question;
      const seen = new Set<string>();
      const drawn = Array.from({ length: question.questionsPerRound }, (_, i) =>
        build({ question }, i, seen),
      );
      const modes = drawn.map((q) => q.mode);
      // Cycled: question n uses mode n, wrapping. Every mode appears.
      expect(new Set(modes).size, `${activity}: ${modes.join(", ")}`).toBe(question.modes.length);
      expect(modes.slice(0, question.modes.length)).toEqual(question.modes);
    });
  }
});

describe("the help is gone, and gone completely", () => {
  for (const activity of ["share", "array", "numberline", "facts", "chunk", "story", "factors", "estimate"]) {
    it(`offers no hint and no read-aloud in ${activity} practice`, () => {
      const lesson = practiceLessons.find((l) => l.activity === `division/${activity}`);
      if (!lesson) throw new Error(`no practice lesson for ${activity}`);
      const h = renderActivity(skill.activities[activity], {
        params: (lesson.params as { question: Record<string, unknown> }).question,
      });
      const buttons = h.buttons();
      expect(buttons.some((b) => /hint/i.test(b)), `${activity} offers a hint`).toBe(false);
      expect(buttons.some((b) => /read|listen|aloud|speak/i.test(b)), `${activity} reads aloud`).toBe(false);
      h.unmount();
    });
  }

  it("says nothing at all when a practice round opens", () => {
    const lesson = practiceLessons.find((l) => l.activity === "division/facts");
    const h = renderActivity(skill.activities.facts, {
      params: (lesson?.params as { question: Record<string, unknown> }).question,
      features: { audio_speech: true },
    });
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });
});

describe("practice is titled as practice and scored as practice", () => {
  it("marks every one of them with the practice flag, not the title", () => {
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
});
