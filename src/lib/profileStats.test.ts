import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Offline repeats what the server last said, and never invents an alternative.
 *
 * These figures used to be computed on the device, so they were always there.
 * Moving them to a stored row is what makes them correctable and historical —
 * but without a cache it also means a tablet that has been in a drawer opens
 * its profile to zeroes, which reads as lost progress rather than as a missing
 * connection.
 */

const SESSION_KEY = "koda_session_v1";
const CACHE_KEY = "koda_profile_stats_v1";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 10 * 60 * 1000,
  deviceId: "d_1",
  familyId: "f_1",
  role: "child",
  learnerId: "l_1",
  learnerName: "Thana",
};

const row = (overrides: Record<string, unknown> = {}) => ({
  source: "recorded",
  updatedAt: "2026-08-21T00:00:00+00:00",
  dayStreak: 6,
  longestStreak: 9,
  totalXp: 480,
  level: 3,
  starsEarned: 42,
  lessonsMastered: 14,
  lessonsAvailable: 15,
  dailyGoal: 5,
  dailySolved: 2,
  topThreeFinishes: 1,
  league: "Bronze",
  badges: [],
  childrenCount: 0,
  codesWaiting: 0,
  permissionsCount: 0,
  ...overrides,
});

const loadModule = async () => await import("./profileStats");

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
});

afterEach(() => vi.unstubAllGlobals());

describe("the profile's figures without a connection", () => {
  it("keeps the last answer the server gave, rather than a wall of zeroes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => row() }),
    );
    const online = await loadModule();
    expect((await online.fetchProfileStats())?.totalXp).toBe(480);

    // Same device, same account, no network.
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const offline = await loadModule();
    const stats = await offline.fetchProfileStats();

    expect(stats?.totalXp).toBe(480);
    expect(stats?.dayStreak).toBe(6);
  });

  it("never hands one account's figures to another on a shared tablet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => row() }),
    );
    await (await loadModule()).fetchProfileStats();

    // The parent takes the tablet back, and the network is gone.
    vi.resetModules();
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ ...session, role: "owner", learnerId: undefined, userId: "u_1" }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    // No cache for this subject, so nothing is shown — not the child's streak.
    expect(await (await loadModule()).fetchProfileStats()).toBeNull();
    expect(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}")).toHaveProperty("l_1");
  });
});

describe("the writer that fills the row", () => {
  it("sends the real figures, and nothing it cannot measure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => row({ dayStreak: 3 }) });
    vi.stubGlobal("fetch", fetchMock);

    await (await loadModule()).publishLearnerFigures({
      dayStreak: 3,
      longestStreak: 4,
      totalXp: 188,
      level: 2,
      starsEarned: 11,
      lessonsMastered: 5,
      lessonsAvailable: 15,
      dailyGoal: 5,
      dailySolved: 1,
      badges: ["first-steps"],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/profile/stats");
    expect(init.method).toBe("PATCH");
    const sent = JSON.parse(init.body as string);
    expect(sent.dayStreak).toBe(3);
    expect(sent.totalXp).toBe(188);
    expect(sent.badges).toEqual(["first-steps"]);
    // Two figures have no feature behind them yet; inventing one is worse than
    // leaving the row's own value alone.
    expect(sent).not.toHaveProperty("league");
    expect(sent).not.toHaveProperty("topThreeFinishes");
  });

  it("hands the new row to a profile that is already open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => row({ totalXp: 188 }) }),
    );
    const mod = await loadModule();
    const seen: number[] = [];
    const stop = mod.subscribeProfileStats((updated) => seen.push(updated.totalXp));

    await mod.publishLearnerFigures({
      dayStreak: 1,
      longestStreak: 1,
      totalXp: 188,
      level: 1,
      starsEarned: 0,
      lessonsMastered: 0,
      lessonsAvailable: 15,
      dailyGoal: 5,
      dailySolved: 1,
      badges: ["first-steps"],
    });
    stop();

    expect(seen).toEqual([188]);
  });

  it("stays quiet when the device is offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const mod = await loadModule();
    await expect(
      mod.publishLearnerFigures({
        dayStreak: 1,
        longestStreak: 1,
        totalXp: 10,
        level: 1,
        starsEarned: 0,
        lessonsMastered: 0,
        lessonsAvailable: 15,
        dailyGoal: 5,
        dailySolved: 1,
      badges: ["first-steps"],
      }),
    ).resolves.toBeUndefined();
  });
});
