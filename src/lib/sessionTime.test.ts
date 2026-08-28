import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The day's clock, and the cap read against it.
 *
 * The rules worth pinning down are the ones nobody wants to verify by waiting:
 * a tally that belongs to yesterday is not spent today, and the day rolls over
 * on the family's own boundary rather than at midnight.
 */

vi.mock("./learnerProgress", () => ({ currentLearnerId: () => "l_mia" }));

const STREAK_KEY = "koda_streak_v1";

const load = async () => await import("./sessionTime");

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("a cap", () => {
  it("is never reached when there is not one", async () => {
    const { capReached, minutesLeft } = await load();

    expect(capReached(9000, null)).toBe(false);
    expect(minutesLeft(9000, null)).toBeNull();
  });

  it("is reached exactly on the minute it names, not after it", async () => {
    const { capReached } = await load();

    expect(capReached(19, 20)).toBe(false);
    expect(capReached(20, 20)).toBe(true);
  });

  it("never reports less than no time left", async () => {
    const { minutesLeft } = await load();

    expect(minutesLeft(35, 20)).toBe(0);
    expect(minutesLeft(5, 20)).toBe(15);
  });
});

describe("time played", () => {
  it("starts at nothing", async () => {
    const { SessionTimeAPI } = await load();

    expect(SessionTimeAPI.spentToday("l_mia")).toBe(0);
  });

  it("adds up across a session", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(90, "l_mia");
    SessionTimeAPI.record(90, "l_mia");

    expect(SessionTimeAPI.spentToday("l_mia")).toBe(3);
  });

  it("counts only whole minutes — a part-minute is not spent", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(119, "l_mia");

    expect(SessionTimeAPI.spentToday("l_mia")).toBe(1);
    expect(SessionTimeAPI.secondsToday("l_mia")).toBe(119);
  });

  it("ignores a negative or nonsense reading rather than banking it", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(-600, "l_mia");
    SessionTimeAPI.record(Number.NaN, "l_mia");

    expect(SessionTimeAPI.secondsToday("l_mia")).toBe(0);
  });

  it("keeps two children on one tablet apart", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(600, "l_mia");

    expect(SessionTimeAPI.spentToday("l_mia")).toBe(10);
    expect(SessionTimeAPI.spentToday("l_sam")).toBe(0);
  });
});

describe("the day rolling over", () => {
  it("gives a child their time back tomorrow", async () => {
    const { SessionTimeAPI } = await load();
    const monday = new Date("2026-08-24T18:00:00");
    const tuesday = new Date("2026-08-25T09:00:00");

    SessionTimeAPI.record(1200, "l_mia", monday);
    expect(SessionTimeAPI.spentToday("l_mia", monday)).toBe(20);

    // Nothing runs at midnight — the tally is simply read as not being today's.
    expect(SessionTimeAPI.spentToday("l_mia", tuesday)).toBe(0);
  });

  it("rolls over on the family's boundary, not on midnight", async () => {
    // A household that put the day boundary at 4am: a 12:30am session still
    // belongs to the evening it is part of, and must still be capped by it.
    localStorage.setItem(STREAK_KEY, JSON.stringify({ dayStartHour: 4 }));
    const { SessionTimeAPI } = await load();

    const lateEvening = new Date("2026-08-24T22:00:00");
    const afterMidnight = new Date("2026-08-25T00:30:00");
    const properlyTomorrow = new Date("2026-08-25T09:00:00");

    SessionTimeAPI.record(1200, "l_mia", lateEvening);

    expect(SessionTimeAPI.spentToday("l_mia", afterMidnight)).toBe(20);
    expect(SessionTimeAPI.spentToday("l_mia", properlyTomorrow)).toBe(0);
  });
});

describe("giving a day back", () => {
  it("is possible, because a parent may change their mind", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(1800, "l_mia");
    SessionTimeAPI.reset("l_mia");

    expect(SessionTimeAPI.spentToday("l_mia")).toBe(0);
  });
});

describe("the rule a cap is there to enforce", () => {
  /**
   * The composition, not the parts.
   *
   * `capReached` and the tally are each correct alone; what a parent is buying
   * is the sentence they make together — play until the cap, then no more
   * rounds until tomorrow. These read the way `App.startLesson` reads them.
   */
  const CAP = 20;
  const mayStart = async (now: Date) => {
    const { SessionTimeAPI, capReached } = await load();
    return !capReached(SessionTimeAPI.spentToday("l_mia", now), CAP);
  };

  it("lets a child start while there is time", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(10 * 60, "l_mia");

    expect(await mayStart(new Date())).toBe(true);
  });

  it("refuses the next round once the cap is spent", async () => {
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(CAP * 60, "l_mia");

    expect(await mayStart(new Date())).toBe(false);
  });

  it("still refuses when a round overran the cap", async () => {
    // A round already started is always finished, so the tally can pass the
    // cap. That must not wrap around into permission to start another.
    const { SessionTimeAPI } = await load();
    SessionTimeAPI.record(CAP * 60 + 240, "l_mia");

    expect(await mayStart(new Date())).toBe(false);
  });

  it("lets them start again tomorrow", async () => {
    const { SessionTimeAPI } = await load();
    const tonight = new Date("2026-08-24T19:00:00");
    SessionTimeAPI.record(CAP * 60, "l_mia", tonight);

    expect(await mayStart(tonight)).toBe(false);
    expect(await mayStart(new Date("2026-08-25T08:00:00"))).toBe(true);
  });

  it("never refuses a child whose grown-up set no cap", async () => {
    const { SessionTimeAPI, capReached } = await load();
    SessionTimeAPI.record(6 * 60 * 60, "l_mia");

    expect(capReached(SessionTimeAPI.spentToday("l_mia"), null)).toBe(false);
  });

  it("does not spend one child's day on their sibling's play", async () => {
    const { SessionTimeAPI, capReached } = await load();
    SessionTimeAPI.record(CAP * 60, "l_sam");

    expect(capReached(SessionTimeAPI.spentToday("l_mia"), CAP)).toBe(false);
  });
});
