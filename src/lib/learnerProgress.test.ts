import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One record per learner, on a device every child in the family shares.
 *
 * The regression this exists to stop: two children signed in to one tablet in
 * turn, both reading `koda_learner_progress_v1`, so the second opened the app
 * to the first one's XP, stars and streak — and then saved it back up under
 * their own name, which spread the mix-up to every other device.
 */

let learner: string | null = "l_thana";

const recordDoc = vi.fn();
vi.mock("./sync", async () => {
  const kinds = await vi.importActual<typeof import("./sync/kinds")>("./sync/kinds");
  return {
    storageKeyFor: kinds.storageKeyFor,
    SessionAPI: { current: () => (learner ? { learnerId: learner } : { userId: "u_1" }) },
    SyncEngine: { recordDoc: (...args: unknown[]) => recordDoc(...args) },
  };
});

vi.mock("./learning/learningLog", () => ({ learnerId: "l_thisdevice" }));

const store = async () => await import("./learnerProgress");

beforeEach(() => {
  vi.resetModules();
  recordDoc.mockClear();
  localStorage.clear();
  learner = "l_thana";
});

describe("two children on one tablet", () => {
  it("keeps a record each", async () => {
    const { loadProgress, saveProgress, EMPTY_PROGRESS } = await store();
    saveProgress({ ...EMPTY_PROGRESS, xp: 216, streakDays: 4 });

    learner = "l_jutta";
    expect(loadProgress().xp).toBe(0);
    expect(loadProgress().streakDays).toBe(0);

    saveProgress({ ...EMPTY_PROGRESS, xp: 30 });
    learner = "l_thana";
    expect(loadProgress().xp).toBe(216);
  });

  it("uploads each record under the learner it belongs to", async () => {
    const { saveProgress, saveCompletedLevels, EMPTY_PROGRESS } = await store();
    saveProgress({ ...EMPTY_PROGRESS, xp: 216 });
    saveCompletedLevels({ 1: 3 });

    expect(recordDoc.mock.calls[0].slice(0, 2)).toEqual(["progress", "l_thana"]);
    expect(recordDoc.mock.calls[0][3]).toEqual({ learnerId: "l_thana" });
    expect(recordDoc.mock.calls[1].slice(0, 2)).toEqual(["levels", "l_thana"]);
  });

  it("erases only the child who asked", async () => {
    const { loadProgress, saveProgress, clearProgress, EMPTY_PROGRESS } = await store();
    saveProgress({ ...EMPTY_PROGRESS, xp: 216 });
    learner = "l_jutta";
    saveProgress({ ...EMPTY_PROGRESS, xp: 30 });

    clearProgress();
    expect(loadProgress().xp).toBe(0);
    learner = "l_thana";
    expect(loadProgress().xp).toBe(216);
  });
});

describe("the record a device kept before records were per-learner", () => {
  it("is claimed by the first learner to read it, once", async () => {
    localStorage.setItem("koda_learner_progress_v1", JSON.stringify({ xp: 216, streakDays: 4 }));
    const { loadProgress } = await store();

    expect(loadProgress().xp).toBe(216);
    // Handing a copy to the next child would turn one real record into two
    // false ones.
    learner = "l_jutta";
    expect(loadProgress().xp).toBe(0);
    expect(localStorage.getItem("koda_learner_progress_v1")).toBeNull();
  });

  it("is left for a child to claim when an adult signs in first", async () => {
    localStorage.setItem("koda_learner_progress_v1", JSON.stringify({ xp: 216 }));
    learner = null; // a parent: no learner id
    const { loadProgress } = await store();

    expect(loadProgress().xp).toBe(0);
    expect(localStorage.getItem("koda_learner_progress_v1")).not.toBeNull();
  });

  it("never overwrites a record the learner already has", async () => {
    const { loadProgress, saveProgress, EMPTY_PROGRESS } = await store();
    saveProgress({ ...EMPTY_PROGRESS, xp: 30 });
    localStorage.setItem("koda_learner_progress_v1", JSON.stringify({ xp: 999 }));

    expect(loadProgress().xp).toBe(30);
  });
});

describe("the daily goal", () => {
  it("reaches the record from the document the family sets", async () => {
    const { loadProgress } = await store();
    expect(loadProgress().dailyGoal).toBe(5);

    const { DailyGoalAPI } = await import("./dailyGoal");
    DailyGoalAPI.set("l_thana", 8);

    // Overlaid, not stored: one number, from the place that owns it.
    expect(loadProgress().dailyGoal).toBe(8);
    learner = "l_jutta";
    expect(loadProgress().dailyGoal).toBe(5);
  });
});

describe("a record arriving from another device", () => {
  it("wakes the app for this learner, and not for their sibling", async () => {
    const { subscribeLearnerRecord } = await store();
    let woken = 0;
    const stop = subscribeLearnerRecord(() => (woken += 1));

    window.dispatchEvent(
      new StorageEvent("storage", { key: "koda_learner_progress_v1__l_jutta" }),
    );
    expect(woken).toBe(0);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "koda_learner_progress_v1__l_thana" }),
    );
    expect(woken).toBe(1);

    // A goal set for this learner is a change to what they see today.
    window.dispatchEvent(new StorageEvent("storage", { key: "koda_daily_goal_v1__l_thana" }));
    expect(woken).toBe(2);
    stop();
  });
});
