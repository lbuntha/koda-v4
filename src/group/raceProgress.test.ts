import { describe, expect, it } from "vitest";
import { createRaceTracker, type RaceProgress } from "./raceProgress";

const track = () => {
  const seen: RaceProgress[] = [];
  return { tracker: createRaceTracker((p) => seen.push(p)), seen };
};

describe("race progress", () => {
  it("counts a question right first time, and one right after a miss only as finished", () => {
    const { tracker, seen } = track();
    tracker.answered({ questionId: "q1", correct: true });
    tracker.answered({ questionId: "q2", correct: false });
    expect(seen).toHaveLength(1); // a wrong answer moves nothing
    tracker.answered({ questionId: "q2", correct: true });
    expect(tracker.progress()).toEqual({ answered: 2, firstTry: 1, done: false });
  });

  it("does not count a question twice, however often it is reported", () => {
    const { tracker, seen } = track();
    tracker.answered({ questionId: "q1", correct: true });
    tracker.answered({ questionId: "q1", correct: true });
    expect(seen).toHaveLength(1);
    expect(tracker.progress().answered).toBe(1);
  });

  it("says done once, with the final counts", () => {
    const { tracker, seen } = track();
    tracker.answered({ questionId: "q1", correct: true });
    tracker.completed();
    tracker.completed();
    expect(seen.at(-1)).toEqual({ answered: 1, firstTry: 1, done: true });
    expect(seen.filter((p) => p.done)).toHaveLength(1);
  });
});
