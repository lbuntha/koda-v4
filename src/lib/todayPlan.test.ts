import { beforeEach, describe, expect, it } from "vitest";
import type { LearningEvent } from "./learning/events";
import { emptyStore, type ReviewStore } from "./learning/review";
import { buildPlan, planFor, stepDone, type PlanInput } from "./todayPlan";

const store: ReviewStore = {
  ...emptyStore(),
  mistakes: {
    "addition/doubles": { key: "addition/doubles", skillId: "addition", lessonId: "doubles", activityId: "a", conceptKey: "add-doubles", examples: [], firstDay: "2026-11-18", lastWrongDay: "2026-11-18", misses: 3, rightDays: [], dueDay: "2026-11-19" },
    "addition/bonds": { key: "addition/bonds", skillId: "addition", lessonId: "bonds", activityId: "a", conceptKey: "add-bonds", examples: [], firstDay: "2026-11-19", lastWrongDay: "2026-11-19", misses: 1, rightDays: [], dueDay: "2026-11-20" },
    "addition/later": { key: "addition/later", skillId: "addition", lessonId: "later", activityId: "a", conceptKey: "add-later", examples: [], firstDay: "2026-11-20", lastWrongDay: "2026-11-20", misses: 1, rightDays: [], dueDay: "2026-11-21" },
    "subtraction/third": { key: "subtraction/third", skillId: "subtraction", lessonId: "third", activityId: "a", conceptKey: "sub-third", examples: [], firstDay: "2026-11-17", lastWrongDay: "2026-11-17", misses: 1, rightDays: [], dueDay: "2026-11-20" },
  },
  topics: {
    "count-on": { conceptKey: "count-on", skillId: "addition", lessonId: "count-on", activityId: "a", step: 1, lastDay: "2026-11-17", dueDay: "2026-11-20" },
  },
};

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  day: "2026-11-20",
  now: new Date("2026-11-20T02:00:00Z"),
  reviewOn: true,
  store,
  canStart: () => true,
  newRef: "addition/next-thing",
  read: { bookId: "book-1", title: "My Cat" },
  write: { collectionId: "khmer-letters", title: "Khmer letters" },
  ...over,
});

describe("building today's plan", () => {
  it("goes review, two mistakes (most missed first), new, read, write", () => {
    const plan = buildPlan(input());
    expect(plan.steps.map((s) => [s.kind, s.ref ?? s.bookId ?? s.collectionId])).toEqual([
      ["review", "addition/count-on"],
      ["fix", "addition/doubles"],
      ["fix", "addition/bonds"],
      ["new", "addition/next-thing"],
      ["read", "book-1"],
      ["write", "khmer-letters"],
    ]);
  });

  it("calls an unfinished round Carry on rather than New", () => {
    expect(buildPlan(input({ newIsResume: true })).steps.find((s) => s.ref === "addition/next-thing")?.kind).toBe("continue");
  });

  it("after three days away, says welcome back and gives one mistake, not two", () => {
    const back = buildPlan(input({ daysAway: 4 }));
    expect(back.welcomeBack).toBe(true);
    expect(back.steps.filter((s) => s.kind === "fix")).toHaveLength(1);
    expect(back.steps[0].kind).toBe("review");
    const usual = buildPlan(input({ daysAway: 1 }));
    expect(usual.welcomeBack).toBeUndefined();
    expect(usual.steps.filter((s) => s.kind === "fix")).toHaveLength(2);
  });

  it("leaves out review and mistakes when the switch is off", () => {
    expect(buildPlan(input({ reviewOn: false })).steps.map((s) => s.kind)).toEqual(["new", "read", "write"]);
  });

  it("skips a lesson that cannot be started and never lists one lesson twice", () => {
    const plan = buildPlan(input({ canStart: (ref) => ref !== "addition/doubles", newRef: "addition/bonds" }));
    expect(plan.steps.filter((s) => s.ref).map((s) => s.ref)).toEqual(["addition/count-on", "addition/bonds", "subtraction/third"]);
  });
});

describe("ticking steps off", () => {
  const plan = buildPlan(input());
  const ev = (over: Partial<LearningEvent> & { type: LearningEvent["type"] }): LearningEvent =>
    ({ id: "e", ts: "2026-11-20T03:00:00Z", sessionId: "s", learnerId: "kid", seq: 1, tzOffsetMinutes: 420, localDay: "2026-11-20", skillId: "addition", activityId: "a", lessonId: "doubles", conceptKey: "c", ...over }) as LearningEvent;

  it("counts a finished lesson after the plan was made, for this learner only", () => {
    const fix = plan.steps[1];
    expect(stepDone(fix, plan, [ev({ type: "lesson_completed" })], "kid")).toBe(true);
    expect(stepDone(fix, plan, [ev({ type: "lesson_completed", ts: "2026-11-20T01:00:00Z" })], "kid")).toBe(false);
    expect(stepDone(fix, plan, [ev({ type: "lesson_completed", learnerId: "sibling" })], "kid")).toBe(false);
    expect(stepDone(fix, plan, [ev({ type: "lesson_started" })], "kid")).toBe(false);
    expect(stepDone(fix, plan, [ev({ type: "lesson_completed", entry: "preview" })], "kid")).toBe(false);
  });

  it("counts a finished book and any finished writing", () => {
    const read = plan.steps.find((s) => s.kind === "read")!;
    const write = plan.steps.find((s) => s.kind === "write")!;
    expect(stepDone(read, plan, [ev({ type: "reading_finished", skillId: "koda-library", lessonId: "book-1@3" })], "kid")).toBe(true);
    expect(stepDone(read, plan, [ev({ type: "reading_finished", skillId: "koda-library", lessonId: "book-10@1" })], "kid")).toBe(false);
    expect(stepDone(write, plan, [ev({ type: "lesson_completed", skillId: "koda-trace", lessonId: "ka" })], "kid")).toBe(true);
  });

  it("counts a book whose questions were finished in the passage screen, which logs no reading events", () => {
    const read = plan.steps.find((s) => s.kind === "read")!;
    expect(stepDone(read, plan, [ev({ type: "lesson_completed", skillId: "koda-library", lessonId: "book-1@1" })], "kid")).toBe(true);
    expect(stepDone(read, plan, [ev({ type: "lesson_completed", skillId: "koda-library", lessonId: "book-10@1" })], "kid")).toBe(false);
    expect(stepDone(read, plan, [ev({ type: "lesson_completed", skillId: "counting", lessonId: "book-1@1" })], "kid")).toBe(false);
  });
});

describe("one plan per day", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the same plan through the day, and makes a new one tomorrow or when the switch changes", () => {
    const first = planFor("kid", input());
    const later = planFor("kid", input({ newRef: "addition/something-else", now: new Date("2026-11-20T09:00:00Z") }));
    expect(later).toEqual(first);
    expect(planFor("kid", input({ reviewOn: false })).steps.map((s) => s.kind)).toEqual(["new", "read", "write"]);
    const tomorrow = planFor("kid", input({ day: "2026-11-21", reviewOn: false, newRef: "addition/something-else" }));
    expect(tomorrow.steps[0].ref).toBe("addition/something-else");
  });

  it("adds the puzzle step last, ticks it on any Word Guess game, and grows a plan made before it", () => {
    const plain = planFor("kid", input());
    expect(plain.steps.some((s) => s.kind === "puzzle")).toBe(false);
    const grown = planFor("kid", input({ puzzle: true }));
    expect(grown.steps.at(-1)).toEqual({ kind: "puzzle" });
    expect(grown.createdAt).toBe(plain.createdAt);
    expect(grown.steps.slice(0, -1)).toEqual(plain.steps);
    const puzzle = grown.steps.at(-1)!;
    const done = { id: "e", ts: "2026-11-20T03:00:00Z", sessionId: "s", learnerId: "kid", seq: 1, tzOffsetMinutes: 420, localDay: "2026-11-20", activityId: "a", conceptKey: "c", type: "lesson_completed", skillId: "koda-word-guess", lessonId: "word-guess:en:4" } as LearningEvent;
    expect(stepDone(puzzle, grown, [done], "kid")).toBe(true);
    expect(stepDone(puzzle, grown, [{ ...done, skillId: "koda-rebus" }], "kid")).toBe(false);
    expect(buildPlan(input({ puzzle: true })).steps.map((s) => s.kind)).toEqual(["review", "fix", "fix", "new", "read", "write", "puzzle"]);
  });

  it("does not keep an empty plan", () => {
    planFor("kid", input({ reviewOn: false, newRef: null, read: null, write: null }));
    expect(planFor("kid", input({ reviewOn: false })).steps.length).toBe(3);
  });
});
