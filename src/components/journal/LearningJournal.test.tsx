import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildJournal, type JournalEvent } from "../../lib/learning/journal";
import { localDayOf } from "../../lib/learning/learningLog";

const today = localDayOf(new Date());
const at = (n: number, fields: Partial<JournalEvent>): JournalEvent => ({
  id: `e${n}`, type: "lesson_completed", ts: new Date(Date.now() - 60_000 * (10 - n)).toISOString(), localDay: today,
  skillId: "measurement", lessonId: "read-the-ruler", ...fields,
});
const events: JournalEvent[] = [
  at(1, { type: "page_read", skillId: "koda-library", lessonId: "cat@2", page: 1, pageCount: 5, dwellMs: 60_000 }),
  at(2, { type: "page_read", skillId: "koda-library", lessonId: "cat@2", page: 2, pageCount: 5, dwellMs: 60_000 }),
  at(3, { type: "reading_finished", skillId: "koda-library", lessonId: "cat@2", pageCount: 5 }),
  at(4, { questionsAnswered: 5, correctFirstTry: 4, durationMs: 120_000 }),
];

vi.mock("../../lib/learningJournal", () => ({
  useLearningJournal: () => ({ journal: buildJournal(events), titles: { "cat@2": "The Little Cat" }, settled: true, offline: false }),
}));

describe("LearningJournal", () => {
  it("shows the day's book and lesson, and a line to copy into the reading book", async () => {
    const { LearningJournal } = await import("./LearningJournal");
    render(<LearningJournal learnerId="l_1" />);
    expect(screen.getByText("My learning")).toBeTruthy();
    expect(screen.getAllByText("The Little Cat").length).toBeGreaterThan(0);
    expect(screen.getByText("Read the Ruler")).toBeTruthy();
    const line = screen.getByTestId("handbook-line").textContent!;
    expect(line).toMatch(/Read: The Little Cat \(2 of 4 pages, finished\)/);
    expect(line).toMatch(/Practised: Measure It: Read the Ruler 4\/5/);
  });

  it("names the child on a parent's view", async () => {
    const { LearningJournal } = await import("./LearningJournal");
    render(<LearningJournal learnerId="l_1" learnerName="Dara" />);
    expect(screen.getByText("Dara's learning")).toBeTruthy();
  });
});
