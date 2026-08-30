import { describe, expect, it } from "vitest";

import { trimPerLearner } from "./learningLog";
import type { LearningEvent } from "./events";

/**
 * Whose history is kept when the device runs out of room.
 *
 * The log used to be one ring of 2000 trimmed oldest-first across everybody. On
 * a shared family tablet that means a busy sibling silently evicts a quieter
 * child's history — and the quiet child is exactly the one whose few records
 * matter most to a recommendation. A cap one user can spend on another's behalf
 * is not a retention rule, it is a race.
 *
 * These are about fairness, which is invisible until a second child picks up
 * the tablet, and therefore invisible to every test written with one.
 */

const event = (learnerId: string, n: number, localDay = "2026-01-01"): LearningEvent =>
  ({
    id: `${learnerId}_${n}`,
    ts: new Date(2026, 0, 1, 0, 0, n).toISOString(),
    type: "answer_submitted",
    sessionId: "s",
    learnerId,
    seq: n,
    localDay,
    conceptKey: "corresponder",
    skillId: "counting",
  }) as unknown as LearningEvent;

const forLearner = (kept: LearningEvent[], learnerId: string) =>
  kept.filter((e) => e.learnerId === learnerId);

describe("retention is per learner", () => {
  it("keeps a quiet child's history however busy their sibling is", () => {
    // Mia plays all afternoon; Sam answers five questions all week.
    const mia = Array.from({ length: 5000 }, (_, i) => event("l_mia", i));
    const sam = Array.from({ length: 5 }, (_, i) => event("l_sam", i));

    const kept = trimPerLearner([...sam, ...mia]);

    // Every one of Sam's survives. Under the old global ring they were the
    // oldest five on the device and went first.
    expect(forLearner(kept, "l_sam")).toHaveLength(5);
  });

  it("caps each learner on their own volume, not the device's", () => {
    const mia = Array.from({ length: 3000 }, (_, i) => event("l_mia", i));

    const kept = trimPerLearner(mia);

    // Trimmed, and to their own most recent.
    expect(kept.length).toBeLessThan(3000);
    expect(kept.at(-1)?.id).toBe("l_mia_2999");
  });

  it("keeps the newest of a learner's events, not the oldest", () => {
    const mia = Array.from({ length: 4000 }, (_, i) => event("l_mia", i));

    const ids = trimPerLearner(mia).map((e) => e.id);

    expect(ids).toContain("l_mia_3999");
    expect(ids).not.toContain("l_mia_0");
  });

  it("takes from the biggest holder when the whole device is over", () => {
    // Three heavy users: the per-learner cap alone still leaves the device over.
    const learners = ["l_a", "l_b", "l_c"];
    const all = learners.flatMap((id) => Array.from({ length: 1200 }, (_, i) => event(id, i)));

    const kept = trimPerLearner(all);
    const sizes = learners.map((id) => forLearner(kept, id).length);

    // Nobody is wiped out to save the others: the smallest share is still
    // within one of the largest.
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(Math.min(...sizes)).toBeGreaterThan(1000);
  });

  it("leaves a small log completely alone", () => {
    const few = [event("l_mia", 1), event("l_sam", 2)];

    expect(trimPerLearner(few)).toHaveLength(2);
  });

  it("does not lose an event that has no learner recorded", () => {
    // Older records, or one written before a learner was chosen. Dropping them
    // would be a silent data loss during an upgrade.
    const orphan = { ...event("l_mia", 1), learnerId: "" } as LearningEvent;

    expect(trimPerLearner([orphan])).toHaveLength(1);
  });
});


/**
 * How far back the device remembers, per learner.
 *
 * Seven days each — counted in days that learner actually practised, not as a
 * calendar window ending today. A child who only plays on Saturdays would find
 * an empty log every Friday under a rolling window, and every screen that reads
 * it would show a child with no history.
 *
 * None of this is the record. The server keeps everything; this is a tablet's
 * storage budget, and the tests say so.
 */
describe("the device keeps seven days per learner", () => {
  const onDay = (learnerId: string, day: string, n: number) =>
    event(learnerId, n, day);

  it("keeps the seven most recent days and drops the eighth", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
    const all = days.map((day, i) => onDay("l_mia", day, i));

    const kept = trimPerLearner(all).map((e) => e.localDay);

    expect(new Set(kept).size).toBe(7);
    expect(kept).toContain("2026-01-10");
    expect(kept).toContain("2026-01-04");
    expect(kept).not.toContain("2026-01-03");
  });

  it("counts days practised, not days elapsed", () => {
    // Saturdays only, across two months. All seven are recent *for her*.
    const saturdays = ["2026-01-03", "2026-01-10", "2026-01-17", "2026-01-24",
                       "2026-01-31", "2026-02-07", "2026-02-14"];
    const all = saturdays.map((day, i) => onDay("l_sam", day, i));

    const kept = trimPerLearner(all);

    expect(kept).toHaveLength(7);
  });

  it("gives each learner their own seven days", () => {
    // Mia played the last ten days; Sam played ten days in a different month.
    const mia = Array.from({ length: 10 }, (_, i) =>
      onDay("l_mia", `2026-03-${String(i + 1).padStart(2, "0")}`, i));
    const sam = Array.from({ length: 10 }, (_, i) =>
      onDay("l_sam", `2026-01-${String(i + 1).padStart(2, "0")}`, i));

    const kept = trimPerLearner([...mia, ...sam]);

    // Sam's older days are not evicted by Mia having newer ones.
    expect(new Set(forLearner(kept, "l_sam").map((e) => e.localDay)).size).toBe(7);
    expect(new Set(forLearner(kept, "l_mia").map((e) => e.localDay)).size).toBe(7);
  });

  it("keeps an event with no day rather than losing it to an upgrade", () => {
    const dated = Array.from({ length: 9 }, (_, i) =>
      onDay("l_mia", `2026-01-${String(i + 1).padStart(2, "0")}`, i));
    const undated = { ...event("l_mia", 99), localDay: "" } as LearningEvent;

    expect(trimPerLearner([undated, ...dated]).some((e) => e.id === "l_mia_99")).toBe(true);
  });
});
