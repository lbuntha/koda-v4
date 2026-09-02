import { beforeEach, describe, expect, it } from "vitest";

import { LearningLog } from "./learningLog";
import type { LearningEvent } from "./events";
import {
  MIN_PRACTICE_ANSWERS,
  TREND_SAMPLE,
  getPracticeRuns,
  getPracticeStandings,
  getTopSpeeds,
  isPracticeEvent,
} from "./practiceLog";

/**
 * The practice record, as a grown-up has to be able to check it.
 *
 * Every figure on the practice screen is an argument someone will want to have
 * — "she is quicker than that", "he only looks slow because of the hints" — so
 * what these pin down is not the arithmetic but the exclusions: what does not
 * count as speed, and who is not ranked.
 */

let clock = 0;

const record = (event: Partial<LearningEvent> & { type: LearningEvent["type"] }) => {
  clock += 1;
  LearningLog.record({
    id: `e${clock}`,
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
    localDay: "2026-01-01",
    sessionId: "s1",
    learnerId: "l_mia",
    seq: clock,
    skillId: "addition",
    activityId: "bonds",
    lessonId: "practice-bonds",
    conceptKey: "part-whole-decomposer",
    practice: true,
    ...event,
  } as LearningEvent);
};

/** One question asked and answered on the first try. */
const asked = (
  n: number,
  answer: { correct: boolean; responseMs: number; supportsUsed?: number },
  context: Partial<LearningEvent> = {},
) => {
  record({ type: "question_presented", questionId: `q${n}`, index: n, taskKind: "bond", prompt: `bond ${n}`, ...context } as never);
  record({
    type: "answer_submitted",
    questionId: `q${n}`,
    attempt: 1,
    supportsUsed: 0,
    given: "9",
    expected: "9",
    ...answer,
    ...context,
  } as never);
};

beforeEach(() => {
  LearningLog.clear();
  clock = 0;
});

describe("which rounds count as practice", () => {
  it("reads the flag, and falls back to the id only for events written without one", () => {
    const flagged = { practice: true, lessonId: "anything" } as LearningEvent;
    const teaching = { practice: false, lessonId: "practice-bonds" } as LearningEvent;
    const legacy = { lessonId: "practice-bonds" } as LearningEvent;
    const legacyTeaching = { lessonId: "number-bonds" } as LearningEvent;

    expect(isPracticeEvent(flagged)).toBe(true);
    // A teaching round is not made practice by a lesson id that looks like one.
    expect(isPracticeEvent(teaching)).toBe(false);
    expect(isPracticeEvent(legacy)).toBe(true);
    expect(isPracticeEvent(legacyTeaching)).toBe(false);
  });

  it("leaves teaching rounds out of the record entirely", () => {
    record({ type: "lesson_started", entry: "path", practice: false, lessonId: "bonds" } as never);
    asked(1, { correct: true, responseMs: 4000 }, { practice: false, lessonId: "bonds" });

    expect(getPracticeRuns()).toHaveLength(0);
    expect(getPracticeStandings()).toHaveLength(0);
  });
});

describe("a practice round", () => {
  it("reports what was answered, how accurately and how quickly", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    asked(1, { correct: true, responseMs: 4000 });
    asked(2, { correct: false, responseMs: 6000 });
    asked(3, { correct: true, responseMs: 2000 });
    record({
      type: "lesson_completed",
      questionsAnswered: 3,
      correctFirstTry: 2,
      firstTryAccuracy: 2 / 3,
      medianResponseMs: 4000,
      supportsUsed: 0,
      durationMs: 30_000,
    } as never);

    const [run] = getPracticeRuns();
    expect(run.finished).toBe(true);
    expect(run.questionsAnswered).toBe(3);
    expect(run.correctFirstTry).toBe(2);
    expect(run.accuracy).toBeCloseTo(2 / 3);
    expect(run.medianResponseMs).toBe(4000);
    expect(run.fastestCorrectMs).toBe(2000);
    expect(run.durationMs).toBe(30_000);
  });

  it("still appears when the child walked away part-way through", () => {
    // The round a child left is the one worth seeing, so it is not dropped for
    // want of a `lesson_completed` it was never going to send.
    record({ type: "lesson_started", entry: "path" } as never);
    asked(1, { correct: true, responseMs: 3000 });

    const [run] = getPracticeRuns();
    expect(run.finished).toBe(false);
    expect(run.questionsAnswered).toBe(1);
  });

  it("ignores a browse that answered nothing", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    record({ type: "question_presented", questionId: "q1", index: 1, taskKind: "bond" } as never);

    expect(getPracticeRuns()).toHaveLength(0);
  });
});

describe("what does not count as speed", () => {
  it("refuses a correct answer that came in faster than thinking takes", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    asked(1, { correct: true, responseMs: 200 });
    asked(2, { correct: true, responseMs: 3000 });

    // The 200ms tap is kept in the log and kept out of the record: a speed
    // table that rewards it teaches a child to hammer the keypad.
    expect(getPracticeRuns()[0].fastestCorrectMs).toBe(3000);
    expect(getTopSpeeds().map((a) => a.responseMs)).toEqual([3000]);
  });

  it("refuses an answer that was reached with help", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    asked(1, { correct: true, responseMs: 1500, supportsUsed: 1 });
    asked(2, { correct: true, responseMs: 5000 });

    expect(getPracticeRuns()[0].fastestCorrectMs).toBe(5000);
  });

  it("times the first attempt only", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    record({ type: "question_presented", questionId: "q1", index: 1, taskKind: "bond" } as never);
    record({
      type: "answer_submitted",
      questionId: "q1",
      attempt: 1,
      correct: false,
      responseMs: 9000,
      supportsUsed: 0,
    } as never);
    // The retry is quick because the answer is on screen; it is not a record.
    record({
      type: "answer_submitted",
      questionId: "q1",
      attempt: 2,
      correct: true,
      responseMs: 800,
      supportsUsed: 0,
    } as never);

    const [run] = getPracticeRuns();
    expect(run.questionsAnswered).toBe(1);
    expect(run.correctFirstTry).toBe(0);
    expect(run.medianResponseMs).toBe(9000);
    expect(run.fastestCorrectMs).toBeUndefined();
  });
});

describe("standings", () => {
  const practise = (learnerId: string, times: number[], session = "s1") => {
    record({ type: "lesson_started", entry: "path", learnerId, sessionId: session } as never);
    times.forEach((ms, i) =>
      asked(clock + i + 1, { correct: true, responseMs: ms }, { learnerId, sessionId: session }),
    );
  };

  it("ranks the quicker learner first, and says who is quickest of all", () => {
    practise("l_mia", Array(MIN_PRACTICE_ANSWERS).fill(2500), "s_mia");
    practise("l_sam", Array(MIN_PRACTICE_ANSWERS).fill(6000), "s_sam");

    const standings = getPracticeStandings();
    expect(standings.map((s) => s.learnerId)).toEqual(["l_mia", "l_sam"]);
    expect(standings[0].medianResponseMs).toBe(2500);
    expect(standings[0].fastestCorrectMs).toBe(2500);
    expect(standings.every((s) => s.enoughEvidence)).toBe(true);
  });

  it("will not judge a learner on a handful of answers, and still lists them", () => {
    practise("l_mia", Array(MIN_PRACTICE_ANSWERS).fill(4000), "s_mia");
    // Sam has three lucky quick ones. Quickest median in the table, and not
    // something anybody should be shown as a ranking.
    practise("l_sam", [1000, 1100, 1200], "s_sam");

    const standings = getPracticeStandings();
    expect(standings.map((s) => s.learnerId)).toEqual(["l_mia", "l_sam"]);
    expect(standings[1].enoughEvidence).toBe(false);
  });

  it("reports getting faster separately from being fast", () => {
    // Slow to begin with, twice as quick by the end: the learner nobody would
    // call fast, and the one who has improved most.
    practise(
      "l_mia",
      [...Array(TREND_SAMPLE).fill(8000), ...Array(TREND_SAMPLE).fill(4000)],
      "s_mia",
    );

    const [mia] = getPracticeStandings();
    expect(mia.speedUpPercent).toBeCloseTo(50);
    expect(mia.accuracyChange).toBeCloseTo(0);
  });

  it("has no opinion on a trend it has too little practice for", () => {
    practise("l_mia", Array(TREND_SAMPLE * 2 - 1).fill(3000), "s_mia");

    expect(getPracticeStandings()[0].speedUpPercent).toBeUndefined();
  });

  it("shows a speed-up bought by guessing as a drop in accuracy", () => {
    record({ type: "lesson_started", entry: "path" } as never);
    for (let i = 0; i < TREND_SAMPLE; i += 1) asked(i + 1, { correct: true, responseMs: 6000 });
    for (let i = 0; i < TREND_SAMPLE; i += 1) {
      asked(TREND_SAMPLE + i + 1, { correct: false, responseMs: 3000 });
    }

    const [mia] = getPracticeStandings();
    expect(mia.speedUpPercent).toBeCloseTo(50);
    expect(mia.accuracyChange).toBeCloseTo(-1);
  });
});
