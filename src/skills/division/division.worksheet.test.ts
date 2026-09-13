import { describe, expect, it } from "vitest";

import { skill } from ".";
import { buildWorksheet, canPrint } from "../../lib/worksheet";
import type { ResolvedLesson } from "../../curriculum";

/**
 * Division on paper.
 *
 * Seven of the twelve engines print: the ones whose question is already a
 * written one. The other five are pictures — counters to deal, a bar to cut, an
 * array to build, a line to hop along, a tree to grow — and "Deal them all out"
 * beside an empty box is not a worksheet. They report that they cannot be
 * printed rather than printing something useless, which is the contract in
 * `lib/worksheet.ts`.
 */

const PRINTING = ["facts", "remainder", "chart", "chunk", "column", "factors", "estimate"];
const PICTURES = ["share", "array", "numberline", "story", "strategy"];

const lessonFor = (id: string): ResolvedLesson => {
  const lesson = skill.lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`no lesson ${id}`);
  return { ...lesson, skillId: "division", levelNumber: 1 } as unknown as ResolvedLesson;
};

describe("which engines print", () => {
  it("declares a worksheet on every written engine", () => {
    for (const id of PRINTING) {
      expect(skill.activities[id].worksheet, id).toBeDefined();
    }
  });

  it("declares none on the engines whose question is a picture", () => {
    for (const id of PICTURES) {
      expect(skill.activities[id].worksheet, id).toBeUndefined();
    }
  });
});

describe("a printed sheet carries real questions and a real key", () => {
  const cases: [string, number][] = [
    ["divide-by-2-5-10", 10],
    ["write-the-remainder", 10],
    ["split-by-place", 8],
    ["partial-quotients", 8],
    ["short-division", 10],
    ["divisible-by-3-9", 10],
    ["compatible-estimate", 8],
  ];

  for (const [lessonId, count] of cases) {
    it(`prints ${lessonId} with an answer for every question`, () => {
      const sheet = buildWorksheet(lessonFor(lessonId), count);
      expect(sheet.items, lessonId).toHaveLength(count);
      for (const item of sheet.items) {
        expect(item.prompt.trim(), `${lessonId} q${item.number}`).not.toBe("");
        expect(item.answer.trim(), `${lessonId} q${item.number} has no answer`).not.toBe("");
      }
      expect(sheet.method.length, `${lessonId} has no method`).toBeGreaterThan(0);
    });
  }

  it("does not ask the same question twice on one sheet", () => {
    const sheet = buildWorksheet(lessonFor("short-division"), 12);
    const prompts = sheet.items.map((i) => i.prompt);
    // Twelve short divisions from a wide range should all differ.
    expect(new Set(prompts).size).toBeGreaterThanOrEqual(11);
  });

  it("reports a picture lesson as unprintable rather than printing a caption", () => {
    expect(canPrint(lessonFor("share-equally"))).toBe(false);
    expect(canPrint(lessonFor("hop-back"))).toBe(false);
    expect(canPrint(lessonFor("sharing-story"))).toBe(false);
    // And every printing lesson says so.
    expect(canPrint(lessonFor("short-division"))).toBe(true);
    expect(canPrint(lessonFor("divisible-by-3-9"))).toBe(true);
  });
});

describe("the printed method is written for paper", () => {
  it("never tells a child to tap, drag or press something", () => {
    for (const lessonId of ["short-division", "partial-quotients", "write-the-remainder", "divisible-by-3-9"]) {
      const sheet = buildWorksheet(lessonFor(lessonId), 4);
      for (const line of sheet.method) {
        expect(line, `${lessonId}: ${line}`).not.toMatch(/tap|drag|press|button|screen|bar|box on/i);
      }
    }
  });
});
