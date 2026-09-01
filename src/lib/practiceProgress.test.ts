import { beforeEach, describe, expect, it } from "vitest";

import { PracticeProgressAPI } from "./practiceProgress";

/**
 * Holding a child's place in a practice run.
 *
 * The whole value of this store is that it is right about *when there is
 * nothing to resume*. A stale entry is worse than no store at all: it offers a
 * child a card that reopens a run they already finished, and the second time
 * that happens they stop trusting the card.
 */
describe("where a practice run was left", () => {
  beforeEach(() => {
    localStorage.clear();
    PracticeProgressAPI.clearAll();
  });

  it("comes back with the position and the score so far", () => {
    PracticeProgressAPI.save({ levelNumber: 53, answered: 3, correctFirstTry: 2, total: 8 });
    expect(PracticeProgressAPI.get(53)).toMatchObject({
      levelNumber: 53,
      answered: 3,
      correctFirstTry: 2,
      total: 8,
    });
  });

  it("is nothing for a level that was never started", () => {
    expect(PracticeProgressAPI.get(53)).toBeUndefined();
  });

  it("does not offer a run that has not been answered at all", () => {
    // Opening a lesson and leaving immediately is not progress to resume; the
    // card would say "you got to question 0 of 8".
    PracticeProgressAPI.save({ levelNumber: 53, answered: 0, correctFirstTry: 0, total: 8 });
    expect(PracticeProgressAPI.get(53)).toBeUndefined();
    expect(PracticeProgressAPI.all()).toEqual([]);
  });

  it("does not offer a run that reached the end", () => {
    // A finish clears itself. This is the belt-and-braces for a finish that was
    // interrupted before it could — otherwise the card reopens a done round at
    // a question that does not exist.
    PracticeProgressAPI.save({ levelNumber: 53, answered: 8, correctFirstTry: 8, total: 8 });
    expect(PracticeProgressAPI.get(53)).toBeUndefined();
  });

  it("keeps runs apart by level, and clears one without touching the others", () => {
    PracticeProgressAPI.save({ levelNumber: 53, answered: 3, correctFirstTry: 3, total: 8 });
    PracticeProgressAPI.save({ levelNumber: 60, answered: 1, correctFirstTry: 0, total: 8 });
    PracticeProgressAPI.clear(53);
    expect(PracticeProgressAPI.get(53)).toBeUndefined();
    expect(PracticeProgressAPI.get(60)?.answered).toBe(1);
  });

  it("offers the run that was touched most recently", () => {
    PracticeProgressAPI.save({ levelNumber: 53, answered: 3, correctFirstTry: 3, total: 8 });
    PracticeProgressAPI.save({ levelNumber: 60, answered: 1, correctFirstTry: 0, total: 8 });
    // Saved second, so it is the one the child was last in.
    expect(PracticeProgressAPI.latest()?.levelNumber).toBe(60);
  });

  it("survives storage it cannot read", () => {
    localStorage.setItem("koda_practice_progress_v1:device", "not json");
    expect(() => PracticeProgressAPI.all()).not.toThrow();
    expect(PracticeProgressAPI.all()).toEqual([]);
  });
});
