import { describe, expect, it } from "vitest";

import { getCourseLessons, type ResolvedLesson } from "../curriculum";
import { DEFAULT_WORKSHEET_SIZE, buildWorksheet, canPrint } from "./worksheet";
import type { Viewer } from "../skills/viewer";

/**
 * A lesson, on paper.
 *
 * Asserted against the real course rather than a fixture, because the thing
 * that would break this is a real change: a lesson repointed at another engine,
 * a generator that starts refusing draws, an activity that stops exporting what
 * the sheet asks for. A worksheet is also the one surface where being wrong is
 * expensive — a printed answer key cannot be corrected after it is handed over.
 */

const viewer = { age: 99, showAllSkills: true } as Viewer;
const lessons = getCourseLessons(viewer);

const byId = (id: string): ResolvedLesson => {
  const lesson = lessons.find((l) => l.id === id && l.skillId === "addition");
  if (!lesson) throw new Error(`no addition lesson "${id}"`);
  return lesson;
};

describe("which lessons can be printed", () => {
  it("offers the addition lessons whose questions are written ones", () => {
    /* All twelve engines opt in, so most of the skill prints. The count is
       asserted loosely on purpose — a new lesson should not have to edit this
       — but it has to be most of them, or the wiring has come undone. */
    const addition = lessons.filter((l) => l.skillId === "addition");
    expect(addition.length).toBeGreaterThan(50);
    expect(addition.filter(canPrint).length).toBeGreaterThan(addition.length * 0.7);
  });

  it("refuses the ones whose question is a picture", () => {
    /* Counting the things in two bins is not a sentence. The engine says so —
       `printedFor` returns null for those modes — and the lesson stays out of
       the printer rather than printing a caption with nothing under it. The
       last three are engines that have not declared a paper form yet and whose
       prompt does not carry the question either; they leave the same way. */
    const mute = [
      /* Two bins of objects to touch. */
      "count-all",
      "put-groups-together",
      /* Four strategy cards to choose between, each showing its own working.
         Reduced to a sentence it becomes "47 + 8. Which strategy?" — no
         options, nothing to mark. */
      "explain-and-compare",
    ];
    for (const id of mute) {
      expect(canPrint(byId(id)), id).toBe(false);
    }
  });

  it("offers the counting lessons whose apparatus can be drawn", () => {
    /* Counting could not print at all until the figures existed: its questions
       are objects to count and frames to fill, and the caption above them
       ("Touch every fish") carries none of it. With the objects and the frames
       on the page they are worksheets again. */
    const counting = lessons.filter((l) => l.skillId === "counting");
    expect(counting.filter(canPrint).length).toBeGreaterThan(counting.length / 2);
  });

  it("refuses the lessons whose whole point is that nothing stays on the page", () => {
    /* Subitizing is recognising a quantity *without* counting it, enforced by
       showing the dots for a fraction of a second. Paper cannot take anything
       away, so the same dots printed are a counting exercise — the exact thing
       the lesson exists to make unnecessary. */
    for (const id of ["quick-dice-patterns", "quick-dot-groups", "two-color-groups", "practice-subitize"]) {
      const lesson = lessons.find((l) => l.id === id && l.skillId === "counting");
      expect(lesson, id).toBeDefined();
      expect(canPrint(lesson!), id).toBe(false);
    }
  });
});

describe("a printed question carries the whole question", () => {
  /*
   * The bug this contract exists for.
   *
   * Count On's round prompt is "Start at 6 and count on." — complete on screen,
   * where the three things to count on are in the second bin, and unanswerable
   * on paper, where they are nowhere. A printed sheet said "Start at 6 and
   * count on." fifteen times with a blank line beside it.
   */
  it("says how far to count on, not just where to start", () => {
    const sheet = buildWorksheet(byId("count-on"), 6);
    expect(sheet.items.length).toBeGreaterThan(0);

    for (const item of sheet.items) {
      const [, from, on] = item.prompt.match(/Start at (\d+) and count on (\d+)\./) ?? [];
      expect(from, item.prompt).toBeDefined();
      expect(item.answer).toBe(String(Number(from) + Number(on)));
    }
  });

  it("names both numbers where the technique is choosing between them", () => {
    /* "Start with the bigger number, then count on" names neither on paper. */
    const sheet = buildWorksheet(byId("start-with-larger"), 6);
    expect(sheet.items.length).toBeGreaterThan(0);

    for (const item of sheet.items) {
      const [, a, b] = item.prompt.match(/^(\d+) and (\d+)\./) ?? [];
      expect(a, item.prompt).toBeDefined();
      expect(item.answer).toBe(String(Number(a) + Number(b)));
    }
  });

  it("prints written arithmetic as arithmetic", () => {
    /* Adding zero is a rule about numbers, and a sentence would hide it. */
    const sheet = buildWorksheet(byId("add-zero"), 8);
    for (const item of sheet.items) {
      const [, a, b] = item.prompt.match(/^(\d+) \+ (\d+) =$/) ?? [];
      expect(a, item.prompt).toBeDefined();
      expect(item.answer).toBe(String(Number(a) + Number(b)));
    }
  });
});

describe("the sheet teaches before it asks", () => {
  /* Both skills. A method that describes the screen is the same fault
     wherever it is written. */
  const printable = () => lessons.filter(canPrint);

  it("gives every printable lesson a method", () => {
    for (const lesson of printable()) {
      const sheet = buildWorksheet(lesson, 6);
      expect(sheet.method.length, `${lesson.id} has no method`).toBeGreaterThan(0);
    }
  });

  it("never describes the app in a method a child reads on paper", () => {
    /* The reason `method` is declared per technique rather than taken from the
       lesson's `stepByStep`: that copy is written for the help panel inside a
       round, and says things like "Its number is written on the lid" and "Type
       the total and check it". None of it means anything on a page. */
    const screen = /\b(tap|tapping|drag|touch|press|swipe|screen|speaker|button|type|card|lid)\b/i;
    for (const lesson of printable()) {
      for (const step of buildWorksheet(lesson, 6).method) {
        expect(screen.test(step), `${lesson.id}: "${step}"`).toBe(false);
      }
    }
  });

  it("works one example, and does not then ask it", () => {
    /* The example is answered in front of the child. Asking the same question
       four lines later is the sheet marking its own homework.
       Only where the words are the whole question: "How many rockets are
       there?" over eight rockets and over five is the same sentence and two
       different questions, and the drawing is what says so. */
    for (const lesson of printable()) {
      const sheet = buildWorksheet(lesson, 8);
      if (!sheet.example || sheet.example.figure) continue;
      expect(sheet.example.answer, `${lesson.id} example has no answer`).not.toBe("");
      expect(sheet.items.map((i) => i.prompt)).not.toContain(sheet.example.prompt);
    }
  });

  it("numbers the questions from one, whatever the example took", () => {
    const sheet = buildWorksheet(byId("standard-algorithm"), 10);
    expect(sheet.items).toHaveLength(10);
    expect(sheet.items[0].number).toBe(1);
    expect(sheet.items.at(-1)!.number).toBe(10);
  });
});

describe("the sheet a lesson produces", () => {
  it("asks for as many questions as it was asked for", () => {
    const sheet = buildWorksheet(byId("standard-algorithm"), DEFAULT_WORKSHEET_SIZE);
    expect(sheet.items).toHaveLength(DEFAULT_WORKSHEET_SIZE);
    expect(sheet.items.map((i) => i.number)).toEqual(
      Array.from({ length: DEFAULT_WORKSHEET_SIZE }, (_, i) => i + 1),
    );
  });

  it("prints the engine's paper form, not the lesson's screen prompt", () => {
    /* The two differ on purpose, and the paper one wins. A lesson's
       `prompts.default` is written for a round, where the child can see what
       the sentence is about; `printedFor` is written for a sheet, where they
       cannot. Where they happen to say the same thing, nothing is lost. */
    const sheet = buildWorksheet(byId("standard-algorithm"), 10);

    for (const item of sheet.items) {
      const [, a, b] = item.prompt.match(/^(\d+) \+ (\d+)\. Write the carry\.$/) ?? [];
      expect(a, item.prompt).toBeDefined();
      expect(item.answer).toBe(String(Number(a) + Number(b)));
    }
    expect(sheet.lessonTitle).toBe(byId("standard-algorithm").title);
    expect(sheet.skillName).toBe("Addition");
  });

  it("never leaks an internal token onto the answer key", () => {
    /* "Could that be right?" is marked in the log as `too_big`, which is the
       right key there and unreadable on paper. Every answer a grown-up reads
       has to be words or numbers. */
    for (const l of lessons.filter(canPrint)) {
      for (const item of buildWorksheet(l, 4).items) {
        expect(item.answer, `${l.id}: ${item.answer}`).not.toMatch(/_/);
      }
    }
  });

  it("carries an answer for every question", () => {
    /* The half a parent cannot check. An empty answer prints as a dash, which
       is a worksheet quietly failing rather than loudly. */
    for (const id of ["doubles", "number-bonds", "partial-sums", "join-problems"]) {
      const sheet = buildWorksheet(byId(id), 10);
      expect(sheet.items.length, id).toBeGreaterThan(0);
      for (const item of sheet.items) {
        expect(item.answer, `${id} #${item.number}`).not.toBe("");
      }
    }
  });

  it("gets the answers right, on a lesson whose arithmetic is checkable here", () => {
    /* Doubles: the prompt names the number, the answer is twice it. The one
       place this file may do the maths, because the whole point is to catch a
       generator whose `expected` has drifted from what it asks. */
    const sheet = buildWorksheet(byId("doubles"), 10);

    for (const item of sheet.items) {
      const n = Number(item.prompt.match(/Double (\d+)/)?.[1]);
      expect(Number.isFinite(n), item.prompt).toBe(true);
      expect(item.answer, item.prompt).toBe(String(n + n));
    }
  });

  it("does not ask the same question twice on one sheet", () => {
    /* The round de-duplicates within five questions; a sheet asks for thirty
       at once, and passing one `seen` set across the lot is what stops
       "6 + 7" appearing three times down the page. */
    const sheet = buildWorksheet(byId("partial-sums"), 20);
    const prompts = sheet.items.map((i) => i.prompt);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("stops at what a small lesson can give rather than repeating itself", () => {
    /* `add-zero` draws from one number range, so it runs out. Short is the
       right answer; the dialog says so, and nothing repeats. */
    const sheet = buildWorksheet(byId("add-zero"), 30);
    const prompts = sheet.items.map((i) => i.prompt);

    expect(prompts.length).toBeGreaterThan(0);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("survives a lesson whose questions cannot be written down", () => {
    const subitize = lessons.find((l) => l.id === "quick-dot-groups" && l.skillId === "counting")!;
    const sheet = buildWorksheet(subitize, 10);

    expect(sheet.items).toEqual([]);
    expect(sheet.lessonTitle).toBe(subitize.title);
  });
});
