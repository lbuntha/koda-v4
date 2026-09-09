import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCourseLessons, type ResolvedLesson } from "../../curriculum";
import { buildWorksheet, canPrint, DEFAULT_WORKSHEET_SIZE, MIN_WORKSHEET_ITEMS } from "../../lib/worksheet";
import type { Viewer } from "../viewer";
import { skill } from ".";
import { PALETTE } from "./internal/palette";

/**
 * Every lesson on paper.
 *
 * Carried unpaid since Phase 5, where it was named as exit evidence. A
 * worksheet is the one surface where being wrong is expensive — a printed
 * answer key cannot be corrected after it is handed over — and it is also the
 * one place where every clue kind has to survive with no colour, no chip
 * layout and nothing to tap.
 */

const viewer = { age: 99, showAllSkills: true } as Viewer;
const mine = getCourseLessons(viewer).filter((l) => l.skillId === "color-sweeper");
const byId = (id: string): ResolvedLesson => {
  const lesson = mine.find((l) => l.id === id);
  if (!lesson) throw new Error(`no color-sweeper lesson "${id}"`);
  return lesson;
};

describe("what this skill can print", () => {
  it("has every lesson in the course to print from", () => {
    expect(mine).toHaveLength(skill.lessons.length);
  });

  it.each(mine.map((l) => [l.id, l] as const))("%s prints a full sheet", (_id, lesson) => {
    expect(canPrint(lesson), `${lesson.id} cannot fill a sheet`).toBe(true);
    const sheet = buildWorksheet(lesson, DEFAULT_WORKSHEET_SIZE);
    expect(sheet.items.length, `${lesson.id} ran out of questions`).toBeGreaterThanOrEqual(MIN_WORKSHEET_ITEMS);
    expect(sheet.method.length, `${lesson.id} has no method`).toBeGreaterThan(0);
  });

  it.each(mine.map((l) => [l.id, l] as const))("%s writes a self-contained question", (_id, lesson) => {
    for (const item of buildWorksheet(lesson, 8).items) {
      expect(item.prompt.trim(), lesson.id).not.toBe("");
      /* A printed question that leans on the screen is the failure this
         catches: "the outlined tile" is nothing on paper unless the sentence
         also says which tile that is. */
      if (/outlined/i.test(item.prompt)) {
        expect(item.prompt, `${lesson.id} says "outlined" without saying where`).toMatch(/[Rr]ow \d, column \d/);
      }
      expect(item.answer.trim(), `${lesson.id} has a blank answer key`).not.toBe("");
    }
  });

  it("never prints the same board twice on one sheet", () => {
    /*
     * Compared as boards, not as sentences.
     *
     * In this skill the printed line is generic — "circle every tile that
     * touches the outlined one (row 2, column 2)" — and the board is the
     * question. Ten identical lines beside ten different boards is a fine
     * sheet; two identical boards is the repetition that makes a child put
     * the pencil down.
     */
    for (const lesson of mine) {
      const boards = buildWorksheet(lesson, 10).items
        .map((i) => render(<>{i.figure}</>).container.textContent ?? "");
      expect(new Set(boards).size, `${lesson.id} prints the same board twice`).toBe(boards.length);
    }
  });
});

describe("every clue kind survives the page", () => {
  const sheetFor = (id: string) => buildWorksheet(byId(id), 6);

  it("names what an off-board clue counts over, in words", () => {
    /* On screen these are chips beside the grid. On paper the grid is a
       picture and the chip has to carry itself. */
    for (const [id, phrase] of [
      ["how-many-are-left", /whole board/i],
      ["a-whole-row", /row \d|column \d/i],
      ["a-marked-area", /outlined area/i],
    ] as const) {
      const figures = sheetFor(id).items.map((i) => render(<>{i.figure}</>).container.textContent ?? "");
      expect(figures.some((t) => phrase.test(t)), `${id} prints no ${phrase}`).toBe(true);
    }
  });

  it("spells out a run condition rather than relying on punctuation", () => {
    for (const [id, phrase] of [["all-in-a-run", /together/i], ["a-gap-somewhere", /not together/i]] as const) {
      const figures = sheetFor(id).items.map((i) => render(<>{i.figure}</>).container.textContent ?? "");
      expect(figures.some((t) => phrase.test(t)), `${id} prints no "${phrase}"`).toBe(true);
    }
  });

  it("prints a cross-colour clue's counted colour on the tile", () => {
    const figures = sheetFor("the-one-two-one").items.map((i) => render(<>{i.figure}</>).container);
    /* A 1-2-1 wall on paper is three tiles with numbers on. Which colour they
       count is the whole clue, and colour cannot carry it. */
    const labels = figures.flatMap((c) => [...c.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")!));
    expect(labels.some((l) => /clue counting navy|clue counting orange/.test(l))).toBe(true);
  });

  it("gives every tile a symbol and a letter, so a grey page still reads", () => {
    for (const id of ["zero-means-none", "a-marked-area", "three-color-choices"]) {
      const container = render(<>{sheetFor(id).items[0].figure}</>).container;
      const text = container.textContent ?? "";
      const shown = Object.values(PALETTE).filter((p) => text.includes(p.symbol));
      expect(shown.length, `${id} prints no symbols`).toBeGreaterThan(0);
      for (const paint of shown) {
        expect(text, `${id} prints ${paint.name} with no letter`).toContain(paint.letter);
      }
    }
  });

  it("draws a figure for every lesson, because the board is the question", () => {
    for (const lesson of mine) {
      for (const item of buildWorksheet(lesson, 3).items) {
        expect(item.figure, `${lesson.id} prints text with no board`).toBeTruthy();
        const container = render(<>{item.figure}</>).container;
        expect(container.querySelectorAll("[aria-label]").length, lesson.id).toBeGreaterThan(0);
      }
    }
  });
});

describe("the answer key a grown-up keeps", () => {
  it("gives the colouring lessons a tile-by-tile key", () => {
    for (const id of ["zero-means-none", "one-more-match", "a-whole-row"]) {
      for (const item of buildWorksheet(byId(id), 4).items) {
        expect(String(item.answer)).toMatch(/Row \d, column \d/);
      }
    }
  });

  it("says every acceptable answer where more than one is right", () => {
    /* Auditing a board can have several right answers and explaining a move
       has two wordings. A key naming one of them would mark a correct child
       wrong, on paper, with no way to take it back. */
    const audit = buildWorksheet(byId("spot-a-contradiction"), 4).items;
    expect(audit.some((i) => String(i.answer).startsWith("Any of:"))).toBe(true);
    for (const item of buildWorksheet(byId("explain-the-move"), 4).items) {
      expect(String(item.answer).length).toBeGreaterThan(20);
    }
  });

  it("never prints a colouring board that is already coloured", () => {
    /*
     * Only the colouring lessons. A reading lesson's board is finished on
     * purpose — the child circles tiles or counts them rather than filling
     * anything in — and an audit board is finished because auditing it is the
     * task. Asserting "there must be a blank" across all forty would be
     * asserting that every lesson is the same lesson.
     */
    const colouring = mine.filter((l) => l.activity === "color-sweeper/board");
    expect(colouring.length).toBeGreaterThan(10);
    for (const lesson of colouring) {
      for (const item of buildWorksheet(lesson, 3).items) {
        const text = render(<>{item.figure}</>).container.textContent ?? "";
        expect(text, `${lesson.id} prints a finished board`).toContain("?");
      }
    }
  });
});
