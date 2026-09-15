import { describe, expect, it } from "vitest";

import type { ResolvedLesson } from "../curriculum";
import { outcomeSummary } from "./learnOutcomes";

/* Only the fields the summary reads; the rest of a lesson is irrelevant here. */
const lesson = (n: number, concept = `Outcome ${n}`) =>
  ({ ref: `addition/l${n}`, levelNumber: n, concept }) as ResolvedLesson;

const path = Array.from({ length: 8 }, (_, i) => lesson(i + 1));
const finished = (...levels: number[]) => (l: ResolvedLesson) => levels.includes(l.levelNumber);

describe("what the 'What you'll learn' panel says", () => {
  it("starts a new learner on the first outcome, with the next two after it", () => {
    const summary = outcomeSummary(path, finished(), path[0]);

    expect(summary.starting).toBe(true);
    expect(summary.now?.concept).toBe("Outcome 1");
    expect(summary.learned).toEqual([]);
    expect(summary.comingUp.map((l) => l.concept)).toEqual(["Outcome 2", "Outcome 3"]);
  });

  it("follows the learner: the last three learned, the one now, the two ahead", () => {
    const summary = outcomeSummary(path, finished(1, 2, 3, 4), path[4]);

    expect(summary.starting).toBe(false);
    expect(summary.learned.map((l) => l.concept)).toEqual(["Outcome 2", "Outcome 3", "Outcome 4"]);
    expect(summary.learnedCount).toBe(4);
    expect(summary.now?.concept).toBe("Outcome 5");
    expect(summary.comingUp.map((l) => l.concept)).toEqual(["Outcome 6", "Outcome 7"]);
    expect(summary.total).toBe(8);
  });

  it("says a finished path is finished rather than previewing nothing", () => {
    const summary = outcomeSummary(path, finished(1, 2, 3, 4, 5, 6, 7, 8), undefined);

    expect(summary.allLearned).toBe(true);
    expect(summary.now).toBeUndefined();
    expect(summary.comingUp).toEqual([]);
  });

  it("names one outcome once, however many lessons teach it", () => {
    const repeated = [lesson(1, "Order"), lesson(2, "Order"), lesson(3, "Chains"), lesson(4, "Rules")];
    const summary = outcomeSummary(repeated, finished(), undefined);

    expect(summary.comingUp.map((l) => l.concept)).toEqual(["Order", "Chains", "Rules"]);
  });
});
