import { describe, expect, it } from "vitest";

import {
  buildReport,
  contributionsTo,
  evidenceGap,
  RECENT_DAYS,
  rightFirstTime,
  tooEarlyToRead,
  WEEK_DAYS,
  whatNext,
} from "./childReport";
import { MASTERY_DAYS, MIN_EVIDENCE, masteryFrom } from "./learning/mastery";
import type { ConceptTotals } from "./learning/learningLog";

/**
 * A parent reading a child who plays on another device.
 *
 * The thing worth protecting here is agreement: the rollup the server keeps and
 * the log the child's tablet keeps are the same shape on purpose, so the same
 * judgement has to come out of both. Everything else in this file is about
 * *not* inventing a figure the rollup cannot support.
 */

/** A complete row, as the server sends one that has seen real play. */
const totals = (patch: Partial<ConceptTotals> = {}): ConceptTotals => ({
  conceptKey: "make-ten",
  skillIds: ["counting"],
  questionsAnswered: 10,
  correctFirstTry: 9,
  supportsUsed: 0,
  lessonsCompleted: 2,
  lessonsAbandoned: 0,
  totalResponseMs: 40_000,
  errors: {},
  practisedOn: ["2026-08-20", "2026-08-21"],
  lastSeenTs: "2026-08-21T10:00:00.000Z",
  ...patch,
});

const AUG_24 = new Date("2026-08-24T12:00:00.000Z");

describe("a child's report", () => {
  it("reads a rollup row exactly as the child's own device would", () => {
    const row = totals();
    const report = buildReport("l_1", [row]);

    expect(report.concepts).toHaveLength(1);
    expect(report.concepts[0]).toEqual(masteryFrom(row));
    expect(report.concepts[0].status).toBe("mastered");
  });

  it("fills in fields a rollup row never incremented", () => {
    // `$inc` leaves a field absent rather than zero, so a concept that only
    // ever had supports taken arrives with almost nothing on it.
    const report = buildReport("l_1", [{ conceptKey: "counter", supportsUsed: 3 }]);

    const concept = report.concepts[0];
    expect(concept.questionsAnswered).toBe(0);
    expect(concept.firstTryAccuracy).toBe(0);
    expect(concept.supportRate).toBe(0);
    expect(Number.isNaN(concept.firstTryAccuracy)).toBe(false);
    expect(concept.status).toBe("not-started");
  });

  it("does not judge a concept on too little evidence", () => {
    const report = buildReport("l_1", [
      totals({ questionsAnswered: MIN_EVIDENCE - 1, correctFirstTry: 0 }),
    ]);

    // Nothing right, but far too few answers to call it struggling.
    expect(report.concepts[0].status).toBe("learning");
  });

  it("needs practice on more than one day before it says secure", () => {
    const report = buildReport("l_1", [totals({ practisedOn: ["2026-08-21"] })]);

    expect(MASTERY_DAYS).toBe(2);
    expect(report.concepts[0].status).toBe("practising");
  });

  it("puts what is going wrong before what is settled", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "secure-one" }),
      totals({ conceptKey: "stuck-one", questionsAnswered: 20, correctFirstTry: 2 }),
    ]);

    expect(report.concepts.map((c) => c.conceptKey)).toEqual(["stuck-one", "secure-one"]);
  });

  it("counts a day of practice once, however many concepts it touched", () => {
    const report = buildReport(
      "l_1",
      [
        totals({ conceptKey: "a", practisedOn: ["2026-08-20", "2026-08-21"] }),
        totals({ conceptKey: "b", practisedOn: ["2026-08-21"] }),
      ],
      0,
      AUG_24,
    );

    expect(report.rhythm.daysEver).toBe(2);
    expect(report.rhythm.daysThisWeek).toBe(2);
  });

  it("leaves days outside the week out of the weekly count", () => {
    const report = buildReport(
      "l_1",
      [totals({ practisedOn: ["2026-08-01", "2026-08-23"] })],
      0,
      AUG_24,
    );

    expect(WEEK_DAYS).toBe(7);
    expect(report.rhythm.daysEver).toBe(2);
    expect(report.rhythm.daysThisWeek).toBe(1);
  });

  it("reports the most recent moment across every concept", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "a", lastSeenTs: "2026-08-19T09:00:00.000Z" }),
      totals({ conceptKey: "b", lastSeenTs: "2026-08-23T09:00:00.000Z" }),
    ]);

    expect(report.rhythm.lastSeenTs).toBe("2026-08-23T09:00:00.000Z");
  });

  it("has nothing to say about a child who has never played", () => {
    const report = buildReport("l_1", []);

    expect(report.concepts).toEqual([]);
    expect(report.rhythm.lastSeenTs).toBeUndefined();
    expect(report.rhythm.daysEver).toBe(0);
    expect(report.rhythm.roundsEver).toBe(0);
  });

  it("drops a row with no concept rather than showing a blank one", () => {
    const report = buildReport("l_1", [{ questionsAnswered: 4 }]);

    expect(report.concepts).toEqual([]);
  });
});

describe("how much is known yet", () => {
  it("counts the answers still needed before a concept can be judged", () => {
    const report = buildReport("l_1", [totals({ questionsAnswered: 3, correctFirstTry: 3 })]);

    expect(evidenceGap(report.concepts[0])).toBe(MIN_EVIDENCE - 3);
  });

  it("stops counting once there is enough", () => {
    const report = buildReport("l_1", [totals({ questionsAnswered: MIN_EVIDENCE + 40 })]);

    expect(evidenceGap(report.concepts[0])).toBe(0);
  });

  it("says a young record is too early to read rather than shrugging at it", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "a", questionsAnswered: 2, correctFirstTry: 1 }),
      totals({ conceptKey: "b", questionsAnswered: 1, correctFirstTry: 0 }),
    ]);

    expect(tooEarlyToRead(report)).toBe(true);
  });

  it("is readable as soon as one concept has enough behind it", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "a", questionsAnswered: 2, correctFirstTry: 1 }),
      totals({ conceptKey: "b" }),
    ]);

    expect(tooEarlyToRead(report)).toBe(false);
  });

  it("is not 'too early' for a child who has never played at all", () => {
    // A different page entirely: nothing to read, rather than not enough.
    expect(tooEarlyToRead(buildReport("l_1", []))).toBe(false);
  });
});

describe("what a headline number is made of", () => {
  it("names the lessons behind a total, largest share first", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "a", questionsAnswered: 4, correctFirstTry: 4 }),
      totals({ conceptKey: "b", questionsAnswered: 12, correctFirstTry: 6 }),
    ]);

    const rows = contributionsTo(report.concepts, (c) => c.questionsAnswered);
    expect(rows.map((r) => r.concept.conceptKey)).toEqual(["b", "a"]);
    expect(rows[0].count).toBe(12);
    expect(rows[0].share).toBeCloseTo(0.75);
  });

  it("leaves out a lesson that contributed nothing rather than listing a zero", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "finished", lessonsCompleted: 2 }),
      totals({ conceptKey: "unfinished", lessonsCompleted: 0 }),
    ]);

    const rows = contributionsTo(report.concepts, (c) => c.lessonsCompleted);
    expect(rows.map((r) => r.concept.conceptKey)).toEqual(["finished"]);
  });

  it("has nothing to break down when nothing has been finished", () => {
    const report = buildReport("l_1", [totals({ lessonsCompleted: 0 })]);

    expect(contributionsTo(report.concepts, (c) => c.lessonsCompleted)).toEqual([]);
  });

  it("recovers the count the accuracy rate was divided out of", () => {
    // The panel says "9 right first time", not "75%", so the count has to come
    // back exactly — a rate is all `masteryFrom` keeps.
    const report = buildReport("l_1", [
      totals({ questionsAnswered: 12, correctFirstTry: 9 }),
    ]);

    expect(rightFirstTime(report.concepts[0])).toBe(9);
  });
});

describe("the days a child practised", () => {
  it("lists each day once, newest first, with what was met on it", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "a", practisedOn: ["2026-08-20", "2026-08-21"] }),
      totals({ conceptKey: "b", practisedOn: ["2026-08-21"] }),
    ]);

    expect(report.activity.map((d) => d.day)).toEqual(["2026-08-21", "2026-08-20"]);
    expect(report.activity[0].conceptKeys.sort()).toEqual(["a", "b"]);
    expect(report.activity[1].conceptKeys).toEqual(["a"]);
  });

  it("puts what needs attention first within a day", () => {
    const report = buildReport("l_1", [
      totals({ conceptKey: "secure-one", practisedOn: ["2026-08-21"] }),
      totals({
        conceptKey: "stuck-one",
        questionsAnswered: 20,
        correctFirstTry: 2,
        practisedOn: ["2026-08-21"],
      }),
    ]);

    expect(report.activity[0].conceptKeys).toEqual(["stuck-one", "secure-one"]);
  });

  it("stops at the most recent days rather than every afternoon ever", () => {
    const practisedOn = Array.from({ length: RECENT_DAYS + 6 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    const report = buildReport("l_1", [totals({ practisedOn })]);

    expect(report.activity).toHaveLength(RECENT_DAYS);
    // Newest kept, oldest dropped.
    expect(report.activity[0].day).toBe(practisedOn[practisedOn.length - 1]);
    expect(report.rhythm.daysEver, "the count still knows about all of them").toBe(
      practisedOn.length,
    );
  });

  it("is empty for a child who has never played", () => {
    expect(buildReport("l_1", []).activity).toEqual([]);
  });
});

describe("the one thing to do next", () => {
  /** Lesson titles are the caller's job, so the tests supply their own. */
  const lessonOf = (key: string) => `Lesson ${key}`;
  const move = (rows: ConceptTotals[]) => whatNext(buildReport("l_1", rows), "Mia", lessonOf);

  it("sends a parent to what is going wrong before what is nearly done", () => {
    const next = move([
      totals({ conceptKey: "nearly", practisedOn: ["2026-08-21"] }),
      totals({ conceptKey: "stuck", questionsAnswered: 20, correctFirstTry: 2 }),
    ]);

    expect(next?.conceptKey).toBe("stuck");
    expect(next?.action).toContain("Sit with Mia");
    expect(next?.action).toContain("Lesson stuck");
  });

  it("picks the worst of several that are going wrong", () => {
    const next = move([
      totals({ conceptKey: "bad", questionsAnswered: 20, correctFirstTry: 8 }),
      totals({ conceptKey: "worse", questionsAnswered: 20, correctFirstTry: 2 }),
    ]);

    expect(next?.conceptKey).toBe("worse");
  });

  it("names the missing ingredient, not just the lesson", () => {
    // Accurate, unaided, finished — and all on one afternoon. The only thing
    // left is a second day, so that is what it asks for.
    const next = move([totals({ practisedOn: ["2026-08-21"] })]);

    expect(next?.action).toMatch(/different day/);
    expect(next?.why).toMatch(/one day/);
  });

  it("asks for a round without hints when that is what is missing", () => {
    // Under the mastery bar on accuracy, so it sits in "practising" — and the
    // hint rate is the loudest thing wrong with it.
    const next = move([totals({ questionsAnswered: 20, correctFirstTry: 16, supportsUsed: 15 })]);

    expect(next?.action).toMatch(/hints left closed/);
  });

  it("asks for a finished round when every round was left part-way", () => {
    const next = move([totals({ lessonsCompleted: 0 })]);

    expect(next?.action).toMatch(/all the way to the end/);
  });

  it("asks for more rounds when there is not enough to judge yet", () => {
    const next = move([totals({ questionsAnswered: 3, correctFirstTry: 2 })]);

    expect(next?.conceptKey).toBe("make-ten");
    expect(next?.action).toMatch(/couple more rounds/);
  });

  it("says to move on when everything met is learned", () => {
    const next = move([totals()]);

    expect(next?.conceptKey).toBeNull();
    expect(next?.action).toMatch(/something new/);
  });

  it("has no advice for a child who has never played", () => {
    expect(move([])).toBeNull();
  });
});
