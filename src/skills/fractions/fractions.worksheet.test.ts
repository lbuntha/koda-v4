import { describe, expect, it } from "vitest";

import { skill } from ".";
import { buildWorksheet, canPrint } from "../../lib/worksheet";
import type { ResolvedLesson } from "../../curriculum";

/**
 * Fractions on paper.
 *
 * All twelve engines print, and most of them need their apparatus drawn: "write
 * the fraction for the shaded part" above nothing is a caption, not a question.
 * Division shipped five engines calling themselves unprintable for a release
 * before anybody noticed that what they needed was the figure, so here the
 * figure came first.
 *
 * Two levels are better on paper than on screen, and that is worth saying out
 * loud: level 50 asks a child to write *why* an answer cannot be right, and
 * level 57 asks which route they would take and why. Both are blank lines on a
 * sheet and buttons in a round, and the blank line is the better question.
 */

const PRINTING = [
  "strip", "numberline", "equivalence", "compare", "mixed", "add",
  "multiply", "divide", "decimal", "estimate", "story", "strategy",
];

/**
 * Which engines draw.
 *
 * Only the strategy level writes without a picture: its question is two written
 * fractions and a decision, and a bar beside it would be decoration.
 */
const NO_FIGURE = ["strategy"];

const lessonFor = (id: string): ResolvedLesson => {
  const lesson = skill.lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`no lesson ${id}`);
  return { ...lesson, skillId: "fractions", levelNumber: 1 } as unknown as ResolvedLesson;
};

describe("which engines print", () => {
  it("declares a worksheet on every one of them", () => {
    for (const id of PRINTING) {
      expect(skill.activities[id].worksheet, id).toBeDefined();
      expect(skill.activities[id].worksheet?.printed, `${id} has no printed form`).toBeDefined();
      expect(skill.activities[id].worksheet?.method, `${id} has no method`).toBeDefined();
    }
  });

  it("draws a figure for every engine whose question is a picture", () => {
    for (const id of PRINTING) {
      if (NO_FIGURE.includes(id)) continue;
      expect(skill.activities[id].worksheet?.figure, `${id} has no figure`).toBeDefined();
    }
  });
});

describe("a printed sheet carries real questions and a real key", () => {
  const cases: [string, number][] = [
    ["unit-fraction", 8],
    ["fraction-on-a-line", 8],
    ["make-equivalent", 8],
    ["compare-unlike", 8],
    ["improper-to-mixed", 8],
    ["add-unlike", 10],
    ["subtract-mixed", 8],
    ["fraction-of-amount", 10],
    ["fraction-of-fraction", 8],
    ["how-many-fit", 8],
    ["divide-by-fraction", 8],
    ["hundredths", 10],
    ["percent", 8],
    ["benchmarks", 8],
    ["amount-story", 6],
    ["explain-and-compare", 6],
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

  it("reports every lesson in the skill as printable", () => {
    for (const lesson of skill.lessons) {
      expect(canPrint(lessonFor(lesson.id)), `${lesson.id} cannot be printed`).toBe(true);
    }
  });

  it("prints all sixty-nine, and the count is the claim", () => {
    const printable = skill.lessons.filter((l) => canPrint(lessonFor(l.id)));
    expect(printable).toHaveLength(69);
  });

  it("does not ask the same question twice on one sheet", () => {
    for (const lessonId of ["add-unlike", "hundredths", "fraction-of-amount"]) {
      const sheet = buildWorksheet(lessonFor(lessonId), 12);
      const prompts = sheet.items.map((i) => i.prompt);
      expect(new Set(prompts).size, `${lessonId} repeats itself`).toBeGreaterThanOrEqual(11);
    }
  });
});

describe("the apparatus is on the sheet, and empty", () => {
  it("gives the picture lessons something to work on", () => {
    for (const [lessonId, count] of [
      ["equal-parts", 6],
      ["build-from-units", 6],
      ["fraction-on-a-line", 6],
      ["fraction-of-fraction", 6],
      ["hundredths", 6],
      ["amount-story", 6],
    ] as [string, number][]) {
      const sheet = buildWorksheet(lessonFor(lessonId), count);
      expect(sheet.items, lessonId).toHaveLength(count);
      for (const item of sheet.items) {
        expect(item.figure, `${lessonId} q${item.number} has no apparatus`).toBeTruthy();
        expect(item.answer.trim(), `${lessonId} q${item.number}`).not.toBe("");
        expect(item.prompt.length, `${lessonId} q${item.number} says too little`).toBeGreaterThan(12);
      }
    }
  });

  it("leaves the shading to the child where shading is the question", () => {
    // A figure that already holds the answer is a worked example, not a sheet.
    const sheet = buildWorksheet(lessonFor("build-from-units"), 5);
    for (const item of sheet.items) {
      expect(item.prompt, `q${item.number}`).toMatch(/Shade \d+ of the \d+ parts\./);
      expect(item.figure, `q${item.number}`).toBeTruthy();
    }
  });
});

describe("the printed method is written for paper", () => {
  it("never tells a child to tap, drag or press anything", () => {
    for (const lesson of skill.lessons) {
      const sheet = buildWorksheet(lessonFor(lesson.id), 3);
      for (const line of sheet.method) {
        expect(line, `${lesson.id}: ${line}`).not.toMatch(/\btap|\bdrag|\bpress|button|on screen|the app\b/i);
      }
    }
  });

  it("states a method in more than one line for every teaching lesson", () => {
    for (const lesson of skill.lessons) {
      if ((lesson.params as { question?: { practice?: boolean } })?.question?.practice) continue;
      const sheet = buildWorksheet(lessonFor(lesson.id), 3);
      expect(sheet.method.length, `${lesson.id} has a one-line method`).toBeGreaterThanOrEqual(1);
      for (const line of sheet.method) {
        expect(line.split(/\s+/).length, `${lesson.id}: "${line}"`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("describes the technique, not the round", () => {
    // A method that says "count the shaded parts on the bar" is describing the
    // screen. On paper the child draws the bar.
    for (const lessonId of ["add-unlike", "subtract-mixed", "divide-by-fraction", "percent"]) {
      const sheet = buildWorksheet(lessonFor(lessonId), 3);
      expect(sheet.method.join(" ")).not.toMatch(/\bthis round\b|\bthe screen\b/i);
    }
  });
});

describe("a worked example is given, and it is not one of the questions", () => {
  it("answers the first one in front of them", () => {
    const sheet = buildWorksheet(lessonFor("add-unlike"), 8);
    expect(sheet.example, "no worked example").toBeTruthy();
    const prompts = sheet.items.map((i) => i.prompt);
    expect(prompts).not.toContain(sheet.example?.prompt);
  });
});
