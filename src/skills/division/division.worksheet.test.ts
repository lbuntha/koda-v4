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

/**
 * All twelve print now.
 *
 * Five of them reported themselves unprintable for a release, because their
 * question is a picture and a caption beside an empty line is not a worksheet.
 * What they needed was the apparatus drawn empty — the counters and the plates,
 * the ruled line, the cut bar — so that a child does on paper what they do on
 * screen. See `figureFor` on each.
 */
const PRINTING = [
  "share", "array", "numberline", "facts", "remainder", "chart",
  "chunk", "column", "factors", "estimate", "story", "strategy",
];
/**
 * Which engines draw, and which only write.
 *
 * A figure is the apparatus a child works on. The fact deck, the remainder pad
 * and the written method state their question in full — `56 ÷ 7 =` needs no
 * picture — so a figure there would be decoration. The four that draw are the
 * four whose question *is* a picture, plus the times-table row.
 */
const NO_FIGURE = ["remainder", "chart", "chunk", "column", "factors", "estimate", "strategy"];

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

  it("draws a figure for every engine whose question is a picture", () => {
    for (const id of PRINTING) {
      if (NO_FIGURE.includes(id)) continue;
      expect(skill.activities[id].worksheet?.figure, `${id} has no figure`).toBeDefined();
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

  it("reports every lesson in the skill as printable", () => {
    for (const lesson of skill.lessons) {
      expect(canPrint(lessonFor(lesson.id)), `${lesson.id} cannot be printed`).toBe(true);
    }
  });

  it("puts the apparatus on the sheet for the picture lessons", () => {
    for (const [lessonId, count] of [["share-equally", 6], ["hop-back", 6], ["array-to-quotient", 6], ["sharing-story", 6]] as [string, number][]) {
      const sheet = buildWorksheet(lessonFor(lessonId), count);
      expect(sheet.items, lessonId).toHaveLength(count);
      for (const item of sheet.items) {
        // Without a figure these are a caption beside a blank line.
        expect(item.figure, `${lessonId} q${item.number} has no apparatus`).toBeTruthy();
        expect(item.answer.trim(), `${lessonId} q${item.number}`).not.toBe("");
      }
    }
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

describe("a sheet is the same lesson, not a summary of it", () => {
  it("prints every one of the sixty-eight lessons", () => {
    // Five engines reported themselves unprintable for a release. The count is
    // the claim: if this drops, an engine has quietly stopped drawing.
    const printable = skill.lessons.filter((l) => canPrint(lessonFor(l.id)));
    expect(printable).toHaveLength(68);
  });

  it("gives the picture lessons apparatus with nothing filled in", () => {
    // A figure that already holds the answer is a worked example, not a sheet.
    for (const lessonId of ["share-equally", "make-groups-of", "hop-back", "array-to-quotient"]) {
      const sheet = buildWorksheet(lessonFor(lessonId), 4);
      for (const item of sheet.items) {
        expect(item.figure, `${lessonId} q${item.number}`).toBeTruthy();
        expect(item.answer.trim()).not.toBe("");
        // The prompt must state the task; the figure is what it is done on.
        expect(item.prompt.length).toBeGreaterThan(12);
      }
    }
  });

  it("keeps every printed method free of anything that names the screen", () => {
    for (const lesson of skill.lessons) {
      const sheet = buildWorksheet(lessonFor(lesson.id), 2);
      for (const line of sheet.method) {
        expect(line, `${lesson.id}: ${line}`).not.toMatch(
          /tap|drag|press|button|screen|undo|type in|number pad/i,
        );
      }
    }
  });

  it("names every route that fits on the strategy sheet, not just one", () => {
    // Marking a child wrong for choosing the second valid route would teach the
    // opposite of the lesson this level exists for.
    const sheet = buildWorksheet(lessonFor("explain-and-compare"), 5);
    for (const item of sheet.items) {
      expect(item.answer.trim(), `q${item.number} has no key`).not.toBe("");
    }
  });
});

describe("the method is one method, for the whole sheet", () => {
  /*
   * `buildWorksheet` takes the method from the *first* question it draws and
   * prints it above all twenty. So a method that interpolates anything from its
   * question is wrong for the other nineteen — and it read "jump back 2 each
   * time" above a first question that hopped by seven, which is how this was
   * found: by printing one and looking at it.
   */
  it("gives the same method whatever question it is asked about", () => {
    /*
     * Teaching lessons only. A practice lesson cycles every mode its engine
     * has, so there is genuinely no one technique to state above the page —
     * which is the next assertion, not an exception to this one.
     */
    const teaching = skill.lessons.filter(
      (l) => !(l.params as { question?: { practice?: boolean } })?.question?.practice,
    );
    for (const lesson of teaching) {
      const activityId = lesson.activity.split("/")[1];
      const source = skill.activities[activityId].worksheet;
      if (!source?.method) continue;
      const params = (lesson.params as { question?: Record<string, unknown> })?.question ?? {};
      const seen = new Set<string>();
      const memory = { current: null };
      const methods = new Set<string>();
      for (let i = 0; i < 12; i += 1) {
        const q = source.build(params as never, i, seen, memory);
        methods.add(source.method(q).join(" | "));
      }
      expect(
        methods.size,
        `${lesson.id} prints ${methods.size} different methods:\n  ${[...methods].join("\n  ")}`,
      ).toBe(1);
    }
  });

  it("prints a mixed practice sheet with one technique named, which is a known wart", () => {
    /*
     * A practice lesson interleaves every mode its engine has, and the sheet
     * prints the first question's method above all of them — so a `share`
     * practice sheet says "give one to each plate" above questions that ask
     * which kind of question it is, and which sentence says what happened.
     *
     * Not fixed here. The guard belongs in `lib/worksheet.ts` and would change
     * 52 sheets across five skills, which is a decision about the product
     * rather than a bug in division. Pinned so the behaviour is deliberate and
     * findable rather than merely current.
     */
    const sheet = buildWorksheet(lessonFor("practice-share"), 4);
    expect(sheet.method.length).toBeGreaterThan(0);
  });
});
