import { describe, expect, it } from "vitest";

import { buildReport, evidenceGap, tooEarlyToRead, WEEK_DAYS } from "./childReport";
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
