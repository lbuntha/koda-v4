import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { SKILLS, loadSkill } from "../registry";
import { MIN_WORKSHEET_ITEMS, buildWorksheet, canPrint } from "../../lib/worksheet";
import type { ResolvedLesson } from "../../curriculum";
import { skill } from ".";
import { buildSheetQuestion, figureFor, printedFor, sheetMethod } from "./activities/Sheet";
import type { MergeSetup } from "./internal/rules";

/** Solve a printed line independently, the way a grown-up checking the key would. */
function solve(text: string): string {
  const frac = (x: string) => {
    const [n, d] = x.split("/").map(Number);
    return d ? n / d : n;
  };
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d+) \+ (\d+) \+ ___ = (\d+)$/))) return String(+m[3] - +m[1] - +m[2]);
  if ((m = text.match(/^(\d+) \+ ___ = (\d+)$/)) || (m = text.match(/^___ \+ (\d+) = (\d+)$/))) return String(+m[2] - +m[1]);
  if ((m = text.match(/^___ − (\d+) = (\d+)$/))) return String(+m[1] + +m[2]);
  if ((m = text.match(/^(\d+) − ___ = (\d+)$/))) return String(+m[1] - +m[2]);
  if ((m = text.match(/^___ ones \+ (\d+) ones = 1 ten$/))) return String(10 - +m[1]);
  if ((m = text.match(/^(\d+) × ___ = (\d+)$/)) || (m = text.match(/^___ × (\d+) = (\d+)$/))) return String(+m[2] / +m[1]);
  if ((m = text.match(/^Double ___ = (\d+)$/))) return String(+m[1] / 2);
  if ((m = text.match(/^Double (\d+) = ___$/))) return String(2 * +m[1]);
  if ((m = text.match(/^(\d+) ones \+ ___ ones = 1 ten$/))) return String(10 - +m[1]);
  if ((m = text.match(/^(\d+\/\d+) \+ ___ = 1$/)) || (m = text.match(/^___ \+ (\d+\/\d+) = 1$/))) return String(1 - frac(m[1]));
  throw new Error(`unreadable line: ${text}`);
}

describe("Number Merge worksheets", () => {
  const lessons = skill.lessons.filter((l) => !(l.params as { question: { practice?: boolean } }).question.practice);

  it.each(lessons.map((l) => [l.id, (l.params as { question: MergeSetup }).question] as const))(
    "%s prints fifteen different questions whose key is right",
    (_id, question) => {
      const seen = new Set<string>();
      const lines = new Set<string>();
      for (let i = 0; i < 40 && lines.size < 15; i += 1) {
        const q = buildSheetQuestion({ question }, i, seen);
        const paper = printedFor(q);
        expect(paper.text).toContain("___");
        const solved = solve(paper.text);
        const given = paper.answer.includes("/") ? String(paper.answer.split("/").map(Number).reduce((n, d) => n / d)) : paper.answer;
        expect(Number(given), paper.text).toBeCloseTo(Number(solved), 6);
        expect(Number(given), paper.text).toBeGreaterThan(0);
        expect(sheetMethod(q)[0].length).toBeGreaterThan(10);
        lines.add(paper.text);
      }
      expect(lines.size, "distinct questions").toBeGreaterThanOrEqual(5);
    },
  );

  it("draws the merge for sums, with an empty tile for the answer", () => {
    const q = buildSheetQuestion({ question: { mode: "bond", target: 10 } }, 1);
    const { container } = render(<>{figureFor(q)}</>);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector('rect[stroke-dasharray]')).not.toBeNull();
    expect(container.textContent).toContain(String(q.a));
    expect(container.textContent).not.toContain(String(q.answer) + String(q.makes));
  });

  it("registers the adapter on the board", () => {
    expect(skill.activities.board.worksheet?.printed).toBeDefined();
    expect(skill.activities.board.worksheet?.figure).toBeDefined();
  });
});

describe("Number Merge through the real printer", () => {
  beforeAll(() => Promise.all(SKILLS.map((x) => loadSkill(x.manifest.id))));

  /* A lesson with few facts in it (Make 5 has eight) prints a shorter page rather than repeating one. */
  it.each(skill.lessons.map((l) => [l.id] as const))("%s can be printed, with a worked example and a method", (id) => {
    const lesson = { ...skill.lessons.find((l) => l.id === id)!, skillId: "number-merge", levelNumber: 1 } as unknown as ResolvedLesson;
    expect(canPrint(lesson)).toBe(true);
    const sheet = buildWorksheet(lesson, 15);
    expect(sheet.items.length).toBeGreaterThanOrEqual(MIN_WORKSHEET_ITEMS);
    expect(new Set(sheet.items.map((i) => i.prompt)).size).toBe(sheet.items.length);
    expect(sheet.example).toBeDefined();
    expect(sheet.method.length).toBeGreaterThan(0);
    for (const item of sheet.items) {
      expect(item.prompt).toContain("___");
      expect(item.answer).not.toBe("");
    }
  });
});
