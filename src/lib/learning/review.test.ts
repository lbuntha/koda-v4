import { describe, expect, it } from "vitest";
import type { AnswerSubmittedEvent, LearningEvent, LessonCompletedEvent } from "./events";
import {
  addDays,
  applyEvent,
  dueMistakes,
  dueTopics,
  emptyStore,
  fixedSince,
  readReview,
  recordForReview,
  REVIEW_LADDER,
  type ReviewStore,
} from "./review";

const base = {
  id: "e",
  ts: "2026-11-20T03:00:00Z",
  sessionId: "s",
  learnerId: "kid",
  seq: 1,
  tzOffsetMinutes: 420,
  skillId: "subtraction",
  activityId: "subtraction/tray",
  lessonId: "take-away",
  conceptKey: "sub-take-away",
};

const answer = (day: string, correct: boolean, extra: Partial<AnswerSubmittedEvent> = {}): AnswerSubmittedEvent => ({
  ...base,
  localDay: day,
  type: "answer_submitted",
  questionId: "q",
  correct,
  attempt: 1,
  responseMs: 3000,
  supportsUsed: 0,
  given: correct ? "4" : "5",
  expected: "4",
  ...extra,
});

const completed = (day: string, firstTryAccuracy: number, extra: Partial<LessonCompletedEvent> = {}): LessonCompletedEvent => ({
  ...base,
  localDay: day,
  type: "lesson_completed",
  questionsAnswered: 5,
  correctFirstTry: Math.round(firstTryAccuracy * 5),
  firstTryAccuracy,
  medianResponseMs: 3000,
  supportsUsed: 0,
  durationMs: 60_000,
  ...extra,
});

const fold = (events: LearningEvent[], store: ReviewStore = emptyStore()) => events.reduce(applyEvent, store);

describe("days", () => {
  it("adds calendar days across a month end", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 3)).toBe("2027-01-03");
  });
});

describe("mistakes", () => {
  it("saves a first-try slip with what was given and expected, due the next day", () => {
    const s = fold([answer("2026-11-20", false)]);
    const m = s.mistakes["subtraction/take-away"];
    expect(m).toMatchObject({ misses: 1, dueDay: "2026-11-21", conceptKey: "sub-take-away" });
    expect(m.examples).toEqual([{ day: "2026-11-20", given: "5", expected: "4" }]);
    expect(dueMistakes(s, "2026-11-20")).toHaveLength(0);
    expect(dueMistakes(s, "2026-11-21")).toHaveLength(1);
  });

  it("ignores second tries, previews and events without a concept", () => {
    expect(fold([answer("2026-11-20", false, { attempt: 2 })]).mistakes).toEqual({});
    expect(fold([answer("2026-11-20", false, { entry: "preview" })]).mistakes).toEqual({});
    expect(fold([answer("2026-11-20", false, { conceptKey: "" })]).mistakes).toEqual({});
  });

  it("is fixed after right first tries on two later days, and logged as fixed", () => {
    const s = fold([
      answer("2026-11-20", false),
      answer("2026-11-20", true), // same day: still in their head
      answer("2026-11-21", true),
      answer("2026-11-21", true), // same day twice counts once
    ]);
    expect(s.mistakes["subtraction/take-away"].rightDays).toEqual(["2026-11-21"]);
    expect(s.mistakes["subtraction/take-away"].dueDay).toBe("2026-11-23");
    const done = fold([answer("2026-11-23", true)], s);
    expect(done.mistakes).toEqual({});
    expect(fixedSince(done, "2026-11-17")).toEqual([{ key: "subtraction/take-away", conceptKey: "sub-take-away", day: "2026-11-23" }]);
  });

  it("does not count a right answer that used help", () => {
    const s = fold([answer("2026-11-20", false), answer("2026-11-21", true, { supportsUsed: 1 })]);
    expect(s.mistakes["subtraction/take-away"].rightDays).toEqual([]);
  });

  it("starts the count again on a new slip, and keeps only the last three examples", () => {
    const s = fold([
      answer("2026-11-20", false),
      answer("2026-11-21", true),
      answer("2026-11-22", false, { given: "1" }),
      answer("2026-11-22", false, { given: "2" }),
      answer("2026-11-22", false, { given: "3" }),
    ]);
    const m = s.mistakes["subtraction/take-away"];
    expect(m.rightDays).toEqual([]);
    expect(m.misses).toBe(4);
    expect(m.dueDay).toBe("2026-11-23");
    expect(m.examples.map((e) => e.given)).toEqual(["1", "2", "3"]);
  });
});

describe("topics", () => {
  it("climbs the ladder only when a review is done on or after its due day", () => {
    let s = fold([completed("2026-11-20", 0.9)]);
    expect(s.topics["sub-take-away"]).toMatchObject({ step: 0, dueDay: addDays("2026-11-20", REVIEW_LADDER[0]) });
    s = fold([completed("2026-11-20", 1)], s); // replay the same afternoon
    expect(s.topics["sub-take-away"].step).toBe(0);
    expect(s.topics["sub-take-away"].dueDay).toBe("2026-11-21");
    s = fold([completed("2026-11-21", 0.9)], s);
    expect(s.topics["sub-take-away"]).toMatchObject({ step: 1, dueDay: "2026-11-24" });
    s = fold([completed("2026-11-24", 0.8)], s);
    expect(s.topics["sub-take-away"]).toMatchObject({ step: 2, dueDay: "2026-12-01" });
  });

  it("drops back to one day when a review goes badly", () => {
    const s = fold([completed("2026-11-20", 0.9), completed("2026-11-21", 0.9), completed("2026-11-24", 0.4)]);
    expect(s.topics["sub-take-away"]).toMatchObject({ step: 0, dueDay: "2026-11-25" });
  });

  it("leaves out a due topic that already has an open mistake", () => {
    const s = fold([completed("2026-11-20", 0.9), answer("2026-11-20", false)]);
    expect(dueTopics(s, "2026-11-21")).toEqual([]);
    expect(dueMistakes(s, "2026-11-21")).toHaveLength(1);
  });
});

describe("storage", () => {
  it("keeps each learner apart and survives a bad stored value", () => {
    localStorage.clear();
    recordForReview(answer("2026-11-20", false));
    recordForReview(answer("2026-11-20", false, { learnerId: "sibling", lessonId: "compare" }));
    expect(Object.keys(readReview("kid").mistakes)).toEqual(["subtraction/take-away"]);
    expect(Object.keys(readReview("sibling").mistakes)).toEqual(["subtraction/compare"]);
    localStorage.setItem("koda_review_v1:kid", "{not json");
    expect(readReview("kid")).toEqual(emptyStore());
  });
});
