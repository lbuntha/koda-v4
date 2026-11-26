import { describe, expect, it } from "vitest";
import { buildJournal, mergeJournalEvents, type JournalEvent } from "./journal";
import { localDayOf } from "./learningLog";

const NOW = new Date(2026, 10, 26, 18, 0);
const day = (ago: number) => localDayOf(new Date(2026, 10, 26 - ago, 12));
let n = 0;
const ev = (ago: number, fields: Partial<JournalEvent>): JournalEvent => ({
  id: `e${++n}`,
  type: "lesson_completed",
  ts: new Date(2026, 10, 26 - ago, 9, n).toISOString(),
  localDay: day(ago),
  skillId: "measurement",
  lessonId: "read-the-ruler",
  ...fields,
});
const page = (ago: number, p: number, lessonId = "cat@2") =>
  ev(ago, { type: "page_read", skillId: "koda-library", lessonId, page: p, pageCount: 9, dwellMs: 40_000 });

describe("buildJournal", () => {
  it("puts a day's book and lessons together, newest day first", () => {
    const { days } = buildJournal(
      [
        page(0, 1), page(0, 2), page(0, 2), page(0, 0),
        ev(0, { type: "reading_finished", skillId: "koda-library", lessonId: "cat@2", pageCount: 9 }),
        ev(0, { skillId: "koda-library", lessonId: "cat@2", questionsAnswered: 5, correctFirstTry: 4, durationMs: 60_000 }),
        ev(0, { questionsAnswered: 5, correctFirstTry: 5, durationMs: 120_000 }),
        ev(0, { questionsAnswered: 5, correctFirstTry: 3, durationMs: 90_000 }),
        ev(2, { skillId: "addition", lessonId: "make-ten", questionsAnswered: 10, correctFirstTry: 9, durationMs: 300_000 }),
      ],
      NOW,
    );
    expect(days.map((d) => d.day)).toEqual([day(0), day(2)]);
    const [today] = days;
    expect(today.books).toEqual([
      { bookId: "cat", lessonId: "cat@2", pages: 2, pageCount: 8, finished: true, minutes: 4, quiz: { answered: 5, correctFirstTry: 4 } },
    ]);
    expect(today.lessons).toEqual([
      { skillId: "measurement", lessonId: "read-the-ruler", rounds: 2, answered: 10, correctFirstTry: 8, minutes: 4 },
    ]);
    expect(today).toMatchObject({ answered: 15, correctFirstTry: 12, minutes: 8 });
  });

  it("leaves out previews, unfinished rounds, other activity and days outside the window", () => {
    const { days } = buildJournal(
      [
        ev(0, { entry: "preview", questionsAnswered: 5, correctFirstTry: 5 }),
        ev(0, { type: "lesson_abandoned", questionsAnswered: 3 }),
        ev(0, { type: "answer_submitted" }),
        ev(40, { questionsAnswered: 5, correctFirstTry: 5 }),
        ev(-1, { questionsAnswered: 5, correctFirstTry: 5 }),
      ],
      NOW,
    );
    expect(days).toEqual([]);
  });

  it("counts the week, the streak, books finished once and pages read", () => {
    const { summary } = buildJournal(
      [
        ev(1, { questionsAnswered: 5, correctFirstTry: 4 }),
        ev(2, { questionsAnswered: 5, correctFirstTry: 4 }),
        ev(4, { questionsAnswered: 5, correctFirstTry: 4 }),
        page(1, 1), page(1, 2),
        ev(1, { type: "reading_finished", skillId: "koda-library", lessonId: "cat@2" }),
        ev(4, { type: "reading_finished", skillId: "koda-library", lessonId: "cat@1" }),
      ],
      NOW,
    );
    expect(summary.week).toEqual([false, false, true, false, true, true, false]);
    // Nothing yet today: the streak still counts yesterday and the day before.
    expect(summary.streak).toBe(2);
    expect(summary).toMatchObject({ daysLearned: 3, booksFinished: 1, pagesRead: 2, answered: 15, correctFirstTry: 12 });
  });
});

describe("mergeJournalEvents", () => {
  it("counts an event the device and the server both hold once", () => {
    const a = ev(0, { questionsAnswered: 5, correctFirstTry: 5 });
    const b = ev(0, { questionsAnswered: 5, correctFirstTry: 4 });
    expect(mergeJournalEvents([a], [a, b]).map((e) => e.id)).toEqual([a.id, b.id]);
    expect(buildJournal(mergeJournalEvents([a], [a, b]), NOW).days[0].lessons[0].rounds).toBe(2);
  });
});
