import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A goal set by whoever may set it, for whoever it is for.
 *
 * The two readings this has to keep apart: a parent setting a child's goal from
 * their own device, where nothing local belongs to that child, and a student
 * setting their own. Both write the same kind of document; the key is what says
 * whose it is.
 */

const recordDoc = vi.fn();
vi.mock("./sync", async () => {
  const kinds = await vi.importActual<typeof import("./sync/kinds")>("./sync/kinds");
  return {
    storageKeyFor: kinds.storageKeyFor,
    SyncEngine: { recordDoc: (...args: unknown[]) => recordDoc(...args) },
  };
});

const store = async () => (await import("./dailyGoal")).DailyGoalAPI;

beforeEach(() => {
  vi.resetModules();
  recordDoc.mockClear();
  localStorage.clear();
});

describe("a goal", () => {
  it("is five rounds until somebody sets one", async () => {
    const DailyGoalAPI = await store();
    expect(DailyGoalAPI.for("l_thana")).toBe(5);
    expect(DailyGoalAPI.isSet("l_thana")).toBe(false);
  });

  it("belongs to the learner it names, not the device that set it", async () => {
    const DailyGoalAPI = await store();
    DailyGoalAPI.set("l_thana", 8);
    DailyGoalAPI.set("l_jutta", 3);

    expect(DailyGoalAPI.for("l_thana")).toBe(8);
    expect(DailyGoalAPI.for("l_jutta")).toBe(3);
    expect(DailyGoalAPI.isSet("l_thana")).toBe(true);
  });

  it("uploads one document per learner, keyed by them", async () => {
    const DailyGoalAPI = await store();
    DailyGoalAPI.set("l_thana", 8);

    expect(recordDoc).toHaveBeenCalledTimes(1);
    const [kind, key, body, options] = recordDoc.mock.calls[0];
    expect(kind).toBe("goals");
    expect(key).toBe("l_thana");
    expect(body).toEqual({ dailyGoal: 8 });
    expect(options).toEqual({ learnerId: "l_thana" });
  });

  it("refuses a goal of nothing, and one nobody could meet", async () => {
    const DailyGoalAPI = await store();
    DailyGoalAPI.set("l_thana", 0);
    expect(DailyGoalAPI.for("l_thana")).toBe(1);

    DailyGoalAPI.set("l_thana", 500);
    expect(DailyGoalAPI.for("l_thana")).toBe(20);
  });

  it("takes a goal a parent set on another device", async () => {
    const DailyGoalAPI = await store();
    let told = 0;
    DailyGoalAPI.subscribe(() => (told += 1));

    // What `apply.ts` does with a pulled document: the learner's own key, then
    // the nudge every store listens for.
    localStorage.setItem("koda_daily_goal_v1__l_thana", JSON.stringify({ dailyGoal: 9 }));
    window.dispatchEvent(new StorageEvent("storage", { key: "koda_daily_goal_v1__l_thana" }));

    expect(DailyGoalAPI.for("l_thana")).toBe(9);
    expect(told).toBe(1);
  });

  it("ignores a stored value that is not a number", async () => {
    localStorage.setItem("koda_daily_goal_v1__l_thana", JSON.stringify({ dailyGoal: "lots" }));
    const DailyGoalAPI = await store();
    expect(DailyGoalAPI.for("l_thana")).toBe(5);
  });
});
