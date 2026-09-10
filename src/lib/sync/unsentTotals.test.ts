import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LearningEvent } from "../learning/events";

/**
 * What happens to a child's work when the queue runs out of room.
 *
 * The outbox holds 2000 events — roughly 65 rounds, which is more than a child
 * produces between connections and a great deal less than one produces in three
 * weeks offline. What went over the side used to go for good: the stars and the
 * XP survived, because those are documents, and the evidence underneath them
 * did not. These pin the rule that replaced it — an event is either acknowledged
 * by the server or folded into a total that is sent in its place, and never
 * both.
 */

const recorded = vi.hoisted(() => [] as { kind: string; key: string; body: any }[]);

vi.mock("./engine", () => ({
  SyncEngine: {
    recordDoc: (kind: string, key: string, body: unknown) =>
      recorded.push({ kind, key, body }),
  },
}));

const answer = (n: number, learnerId = "l_mia"): LearningEvent =>
  ({
    id: `e_${n}`,
    ts: `2026-09-0${(n % 9) + 1}T10:00:00.000Z`,
    type: "answer_submitted",
    sessionId: "s",
    learnerId,
    seq: n,
    localDay: `2026-09-0${(n % 9) + 1}`,
    conceptKey: "five-benchmark",
    skillId: "counting",
    activityId: "quest",
    lessonId: "l1",
    correct: true,
    attempt: 1,
    responseMs: 1200,
    supportsUsed: 0,
  }) as unknown as LearningEvent;

const load = async () => (await import("./unsentTotals")).UnsentTotals;

beforeEach(() => {
  vi.resetModules();
  recorded.length = 0;
  localStorage.clear();
});

describe("events the queue could not keep", () => {
  it("folds them into totals and queues those instead", async () => {
    const unsent = await load();

    unsent.absorb([answer(1), answer(2), answer(3)]);

    const doc = recorded.at(-1)!;
    expect(doc.kind).toBe("conceptBaseline");
    expect(doc.body.concepts["five-benchmark"]).toMatchObject({
      questionsAnswered: 3,
      correctFirstTry: 3,
      totalResponseMs: 3600,
    });
  });

  it("sends a running total, so a lost acknowledgement cannot double-count", async () => {
    const unsent = await load();

    unsent.absorb([answer(1), answer(2)]);
    unsent.absorb([answer(3)]);

    // Cumulative, not a delta: the second document *replaces* the first, and
    // the server posts the difference.
    expect(recorded.map((d) => d.body.concepts["five-benchmark"].questionsAnswered)).toEqual([2, 3]);
  });

  it("keeps two children on one tablet apart", async () => {
    const unsent = await load();

    unsent.absorb([answer(1, "l_mia"), answer(2, "l_sam"), answer(3, "l_sam")]);

    const keys = recorded.map((d) => d.key);
    expect(new Set(keys).size).toBe(2);
    const sam = recorded.find((d) => d.key.startsWith("l_sam"))!;
    expect(sam.body.concepts["five-benchmark"].questionsAnswered).toBe(2);
  });

  it("survives a reload — the totals are the record until they are acknowledged", async () => {
    const first = await load();
    first.absorb([answer(1), answer(2)]);

    vi.resetModules();
    const afterReload = await load();
    afterReload.absorb([answer(3)]);

    expect(recorded.at(-1)!.body.concepts["five-benchmark"].questionsAnswered).toBe(3);
  });

  it("ignores events that are evidence about no concept", async () => {
    const unsent = await load();

    unsent.absorb([{ ...answer(1), conceptKey: undefined } as unknown as LearningEvent]);

    expect(recorded).toHaveLength(0);
  });
});

describe("the queue's ceiling", () => {
  it("hands back what it had to drop, oldest first", async () => {
    const { Outbox } = await import("./outbox");

    // 2000 is the ceiling; the 2001st arrival pushes the first one out.
    Outbox.add(Array.from({ length: 2000 }, (_, i) => answer(i)));
    const dropped = Outbox.add([answer(9001)]);

    expect(dropped.map((e) => e.id)).toEqual(["e_0"]);
    expect(Outbox.size()).toBe(2000);
  });

  it("drops nothing while there is room", async () => {
    const { Outbox } = await import("./outbox");

    expect(Outbox.add([answer(1), answer(2)])).toEqual([]);
  });
});

describe("history older than the device's own event ring", () => {
  const totals = (over: Record<string, unknown> = {}) => ({
    conceptKey: "five-benchmark",
    skillIds: ["counting"],
    questionsAnswered: 0,
    correctFirstTry: 0,
    supportsUsed: 0,
    lessonsCompleted: 0,
    lessonsAbandoned: 0,
    totalResponseMs: 0,
    errors: {},
    practisedOn: ["2026-06-01"],
    lastSeenTs: "2026-06-01T09:00:00.000Z",
    ...over,
  });

  it("uploads the rollup less whatever the ring can still account for", async () => {
    const { trimmedAway } = await import("./unsentTotals");

    // A term's work in the rollup; three events left in the ring.
    const missing = trimmedAway(
      { "five-benchmark": totals({ questionsAnswered: 500, correctFirstTry: 400 }) as never },
      [answer(1), answer(2), answer(3)],
    );

    expect(missing["five-benchmark"]).toMatchObject({
      questionsAnswered: 497,
      correctFirstTry: 397,
    });
  });

  it("says nothing when the ring still accounts for all of it", async () => {
    const { trimmedAway } = await import("./unsentTotals");

    const missing = trimmedAway(
      { "five-benchmark": totals({ questionsAnswered: 3, correctFirstTry: 3 }) as never },
      [answer(1), answer(2), answer(3)],
    );

    expect(missing).toEqual({});
  });

  it("never sends a negative total, whatever an older build wrote", async () => {
    const { trimmedAway } = await import("./unsentTotals");

    // A rollup smaller than the ring it is supposed to contain: impossible in
    // principle, seen in practice whenever a fold has changed between builds.
    // Clamped, because a negative would subtract another device's honest work.
    const missing = trimmedAway(
      { "five-benchmark": totals({ questionsAnswered: 1 }) as never },
      [answer(1), answer(2), answer(3)],
    );

    expect(missing).toEqual({});
  });
});
