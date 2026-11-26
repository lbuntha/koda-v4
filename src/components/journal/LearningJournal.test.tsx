import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  it("shows the day's book and lesson, each as one clean row", async () => {
    const { LearningJournal } = await import("./LearningJournal");
    render(<LearningJournal learnerId="l_1" />);
    expect(screen.getByText("My learning")).toBeTruthy();
        const box = within(screen.getByTestId("journal-day"));
    expect(box.getByText("The Little Cat")).toBeTruthy();
    expect(box.getByText("2/4 pages · Finished")).toBeTruthy();
    expect(box.getByText("Read the Ruler")).toBeTruthy();
    expect(box.getByText("4/5 right")).toBeTruthy();
  });

  it("copies the entry as plain lines, one row each", async () => {
    const { handbookEntry, handbookText } = await import("./LearningJournal");
    const { buildJournal: build } = await import("../../lib/learning/journal");
    const t = (key: string, vars?: Record<string, unknown>) =>
      ({ "journal.line.read": "Read", "journal.line.practised": "Practised" })[key] ?? `${key}${vars ? JSON.stringify(vars) : ""}`;
    const entry = handbookEntry(build(events).days[0], { "cat@2": "The Little Cat" }, t as never, "en");
    const lines = handbookText(entry, t as never).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^Read: The Little Cat — /);
    expect(lines[2]).toMatch(/^Practised: Read the Ruler — /);
  });

  it("names the child on a parent's view", async () => {
    const { LearningJournal } = await import("./LearningJournal");
    render(<LearningJournal learnerId="l_1" learnerName="Dara" />);
    expect(screen.getByText("Dara's learning")).toBeTruthy();
  });
});
