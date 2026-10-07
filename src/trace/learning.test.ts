import { beforeEach, describe, expect, it } from "vitest";
import { LearningLog, type LearningEvent } from "../lib/learning";
import { GOLDEN_ITEMS } from "./fixtures/items";
import { TRACE_SKILL_ID, TraceRecorder, conceptFor } from "./learning";

const LETTER = GOLDEN_ITEMS.find((i) => i.kind === "letter") ?? GOLDEN_ITEMS[0];
const events = () => LearningLog.all({ skillId: TRACE_SKILL_ID });
const of = <T extends LearningEvent["type"]>(type: T) => events().filter((e) => e.type === type) as Array<Extract<LearningEvent, { type: T }>>;
const fromCollection = () => new TraceRecorder(LETTER, { collectionId: "khmer-consonants", ages: [6, 8] });

beforeEach(() => {
  localStorage.clear();
  LearningLog.clear();
});

describe("TraceRecorder — writing, in the learning log", () => {
  it("records nothing for an item opened and closed without a try", () => {
    const r = fromCollection();
    r.abandon();
    r.attempt("watch", { passed: true, score: 100 });
    expect(events()).toEqual([]);
  });

  it("opens a lesson on the first counted try, in the standard envelope", () => {
    fromCollection().attempt("big", { passed: true, score: 92 });
    const [started] = of("lesson_started");
    expect(started).toMatchObject({
      skillId: TRACE_SKILL_ID,
      lessonId: LETTER.id,
      conceptKey: conceptFor(LETTER),
      ageBand: [6, 8],
      entry: "picker",
    });
    expect(started.localDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(of("question_presented")[0]).toMatchObject({ taskKind: "trace_big" });
  });

  it("marks a try right only when it passed the step, and names the mistake when it did not", () => {
    const r = fromCollection();
    r.attempt("guided", { passed: false, score: 41, fault: "direction" });
    r.attempt("guided", { passed: true, score: 88 });
    expect(of("answer_submitted").map((a) => [a.correct, a.given])).toEqual([[false, "direction"], [true, "88"]]);
  });

  it("completes on a milestone, with stars and XP, and starts afresh if the child carries on", () => {
    const r = fromCollection();
    r.attempt("copy", { passed: true, score: 95 });
    r.complete("canDo", 3, 40);
    expect(of("lesson_completed")[0]).toMatchObject({ milestone: "canDo", stars: 3, xpEarned: 40, questionsAnswered: 1, correctFirstTry: 1 });
    r.attempt("copy", { passed: true, score: 97 });
    expect(of("lesson_started")).toHaveLength(2);
  });

  it("counts taking the coach's help against an unaided first try", () => {
    const r = fromCollection();
    r.attempt("faded", { passed: false, score: 30, fault: "start" });
    r.support("walkthrough");
    r.attempt("faded", { passed: true, score: 90 });
    r.complete("canDo", 2, 20);
    expect(of("support_used")).toHaveLength(1);
    expect(of("lesson_completed")[0].supportsUsed).toBe(1);
  });

  it("counts a stroke turned away in a guided step as a wrong first try on that try", () => {
    const r = fromCollection();
    r.strokeMissed("guided", "direction");
    r.strokeMissed("guided", "start");
    r.attempt("guided", { passed: true, score: 84 });
    // One try, three answers: two wrong strokes, then the finished try.
    expect(of("question_presented")).toHaveLength(1);
    expect(of("answer_submitted").map((a) => [a.attempt, a.correct, a.given])).toEqual([[1, false, "direction"], [2, false, "start"], [3, true, "84"]]);
    r.complete("canDo", 2, 20);
    expect(of("lesson_completed")[0]).toMatchObject({ questionsAnswered: 1, correctFirstTry: 0 });
    // The next try is a new question.
    r.attempt("guided", { passed: true, score: 95 });
    expect(of("question_presented")).toHaveLength(2);
  });

  it("records leaving mid-item as abandoned", () => {
    const r = fromCollection();
    r.attempt("big", { passed: false, score: 20, fault: "start" });
    r.abandon();
    expect(of("lesson_abandoned")).toHaveLength(1);
  });

  it("keeps an author's own draft out of a child's record as a preview", () => {
    new TraceRecorder(LETTER).attempt("big", { passed: true, score: 90 });
    expect(of("lesson_started")[0].entry).toBe("preview");
  });

  it("files writing by script and drawing on its own", () => {
    expect(conceptFor({ kind: "letter", script: "khmer" })).toBe("trace-write-khmer");
    expect(conceptFor({ kind: "numeral", script: "latin" })).toBe("trace-write-latin");
    expect(conceptFor({ kind: "drawing" })).toBe("trace-draw");
    expect(conceptFor({ kind: "line", script: "latin" })).toBe("trace-draw");
  });
});
