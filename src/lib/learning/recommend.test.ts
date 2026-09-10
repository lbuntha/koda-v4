import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MasteryStatus } from "./mastery";
import type { Catalog, CatalogLesson } from "./recommend";

/**
 * What order lessons come out in.
 *
 * The recommender's two questions — "what now?" after a round, and "what today?"
 * from a cold start — both used to be answered by filtering on *concept*
 * mastery. A concept is taught by up to eight lessons, so mastering it on the
 * first of them made the other seven match no filter and disappear: the learner
 * was advanced to the next concept having done an eighth of the work, and
 * nothing ever offered the lessons in between again.
 *
 * These pin the rule that replaced it: a lesson is offered only when everything
 * before it on its own skill's path is finished. Practice is the deliberate
 * exception and lives in `curriculum/resume.test.ts`, because practice rounds
 * assume nothing of each other and are drawn from at random.
 */

const state = vi.hoisted(() => ({
  statuses: new Map<string, MasteryStatus>(),
  lastSeen: new Map<string, string>(),
}));

vi.mock("./mastery", () => ({
  getConceptMastery: (conceptKey: string) => ({
    conceptKey,
    status: state.statuses.get(conceptKey) ?? "not-started",
    firstTryAccuracy: 0.4,
    questionsAnswered: 10,
    lessonsCompleted: 1,
    supportRate: 0,
    averageResponseMs: 1000,
    daysPractised: 1,
    topErrors: [],
    lastSeenTs: state.lastSeen.get(conceptKey),
  }),
}));

vi.mock("./learningLog", () => ({ LearningLog: { all: () => [] } }));

const { recommendNext, recommendNow } = await import("./recommend");

const lesson = (
  skillId: string,
  n: number,
  conceptKey: string,
  requires: string[] = [],
): CatalogLesson => ({
  ref: `${skillId}/l${n}`,
  skillId,
  lessonId: `l${n}`,
  title: `${skillId} ${n}`,
  conceptKey,
  requires,
  levelNumber: n,
});

/* One skill, five lessons: three teaching the same concept, then two on a
   concept the first three unlock. The shape most of the course has. */
const counting: CatalogLesson[] = [
  lesson("counting", 1, "five-benchmark"),
  lesson("counting", 2, "five-benchmark"),
  lesson("counting", 3, "five-benchmark"),
  lesson("counting", 4, "unitiser-ten", ["five-benchmark"]),
  lesson("counting", 5, "unitiser-ten", ["five-benchmark"]),
];

const catalog: Catalog = {
  lessons: counting,
  skills: [{ skillId: "counting", name: "Counting", teaches: ["five-benchmark"], requires: [] }],
};

const refs = (picks: { lesson: CatalogLesson }[]) => picks.map((p) => p.lesson.ref);

beforeEach(() => {
  state.statuses.clear();
  state.lastSeen.clear();
});

describe("today's lessons follow the path", () => {
  it("offers the next lesson on a mastered concept, not the one after the concept", () => {
    // Lesson 1 went well enough to master `five-benchmark` — which says nothing
    // about lessons 2 and 3, because the child has not seen them.
    state.statuses.set("five-benchmark", "mastered");

    const picks = recommendNow(catalog, {
      limit: 3,
      completed: new Set(["counting/l1"]),
      isSatisfied: (key) => key === "five-benchmark",
    });

    expect(refs(picks)[0]).toBe("counting/l2");
    expect(refs(picks)).not.toContain("counting/l4");
  });

  it("never offers a lesson while an earlier one in the same skill is open", () => {
    state.statuses.set("five-benchmark", "practising");

    const picks = recommendNow(catalog, {
      limit: 3,
      maxPerSkill: 3,
      completed: new Set<string>(),
      isSatisfied: (key) => key === "five-benchmark",
    });

    // A prefix of the skill's own order, whatever else changes.
    expect(refs(picks)).toEqual(["counting/l1", "counting/l2", "counting/l3"]);
  });

  it("gives every subject a turn before giving one of them a second", () => {
    const addition = [lesson("addition", 10, "make-ten"), lesson("addition", 11, "make-ten")];
    const twoSkills: Catalog = {
      lessons: [...counting, ...addition],
      skills: [...catalog.skills, { skillId: "addition", name: "Addition", teaches: [], requires: [] }],
    };

    const picks = recommendNow(twoSkills, { limit: 2, isSatisfied: () => false });

    expect(refs(picks)).toEqual(["counting/l1", "addition/l10"]);
  });

  it("steps back to repair, but never forward past open work", () => {
    // The struggle is on a concept further along; lesson 1 is still open, so
    // repair must not be the excuse that skips it.
    state.statuses.set("unitiser-ten", "struggling");

    const picks = recommendNow(catalog, {
      limit: 3,
      completed: new Set<string>(),
      isSatisfied: () => true,
    });

    expect(refs(picks)[0]).toBe("counting/l1");
    expect(refs(picks)).not.toContain("counting/l4");
  });

  it("does repair a concept the learner has already been through", () => {
    state.statuses.set("five-benchmark", "struggling");

    const picks = recommendNow(catalog, {
      limit: 3,
      completed: new Set(["counting/l1", "counting/l2", "counting/l3"]),
      isSatisfied: () => true,
    });

    expect(picks[0]).toMatchObject({ kind: "review", lesson: { ref: "counting/l1" } });
  });
});

describe("what comes after a round", () => {
  it("advances to the next lesson, not past the rest of the concept", () => {
    state.statuses.set("five-benchmark", "mastered");

    const next = recommendNext(
      { conceptKey: "five-benchmark", ref: "counting/l1", skillId: "counting" },
      catalog,
      { completed: new Set(["counting/l1"]) },
    );

    expect(next.kind).toBe("advance");
    expect(next.lesson?.ref).toBe("counting/l2");
  });

  it("comes back for a lesson skipped earlier once the path ahead is done", () => {
    state.statuses.set("five-benchmark", "mastered");

    const next = recommendNext(
      { conceptKey: "five-benchmark", ref: "counting/l5", skillId: "counting" },
      catalog,
      { completed: new Set(["counting/l1", "counting/l3", "counting/l4", "counting/l5"]) },
    );

    expect(next.lesson?.ref).toBe("counting/l2");
  });

  it("does not hand back a lesson already finished as 'one more round'", () => {
    state.statuses.set("five-benchmark", "practising");

    const next = recommendNext(
      { conceptKey: "five-benchmark", ref: "counting/l1", skillId: "counting" },
      catalog,
      { completed: new Set(["counting/l1", "counting/l2"]) },
    );

    expect(next.kind).toBe("practise");
    expect(next.lesson?.ref).toBe("counting/l3");
  });
});
