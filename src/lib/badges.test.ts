import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A badge is a rule, and earning one is arithmetic.
 *
 * The two things worth pinning down: which figure each metric reads — a streak
 * badge reads the *longest* run, so a break never takes it back — and that a
 * hand-edited list cannot produce a badge nobody can be told they have won.
 */

const STORAGE_KEY = "koda_badges_v1";

const saveRule = vi.fn();
vi.mock("./deploymentRules", () => ({
  saveDeploymentRule: (...args: unknown[]) => saveRule(...args),
}));

const mod = async () => await import("./badges");

beforeEach(() => {
  vi.resetModules();
  saveRule.mockClear();
  localStorage.clear();
});

const rule = (
  over: Partial<import("./badges").BadgeRule> = {},
): import("./badges").BadgeRule => ({
  id: "test",
  label: "Test",
  description: "",
  icon: "award",
  metric: "xp" as const,
  threshold: 50,
  ...over,
});

const figures = (over: Partial<import("./badges").BadgeFigures> = {}) => ({
  xp: 0,
  longestStreak: 0,
  starsEarned: 0,
  ...over,
});

describe("earning", () => {
  it("awards at the threshold, and not one short of it", async () => {
    const { earnedBadges } = await mod();
    const rules = [rule({ threshold: 50 })];

    expect(earnedBadges(rules, figures({ xp: 49 }))).toHaveLength(0);
    expect(earnedBadges(rules, figures({ xp: 50 }))).toHaveLength(1);
    expect(earnedBadges(rules, figures({ xp: 4000 }))).toHaveLength(1);
  });

  it("reads each metric off its own figure", async () => {
    const { earnedBadges } = await mod();
    const rules = [
      rule({ id: "x", metric: "xp", threshold: 10 }),
      rule({ id: "s", metric: "streak", threshold: 10 }),
      rule({ id: "t", metric: "stars", threshold: 10 }),
    ];

    expect(earnedBadges(rules, figures({ xp: 10 })).map((r) => r.id)).toEqual(["x"]);
    expect(earnedBadges(rules, figures({ longestStreak: 10 })).map((r) => r.id)).toEqual(["s"]);
    expect(earnedBadges(rules, figures({ starsEarned: 10 })).map((r) => r.id)).toEqual(["t"]);
  });

  it("keeps a streak badge through a broken streak", async () => {
    const { earnedBadges } = await mod();
    const rules = [rule({ metric: "streak", threshold: 7 })];

    // Today's run is over; the record of the best one is not, and the badge
    // stands on the record.
    expect(earnedBadges(rules, figures({ longestStreak: 9 }))).toHaveLength(1);
  });

  it("takes one back when an owner raises the bar", async () => {
    const { earnedBadges } = await mod();
    const learner = figures({ longestStreak: 8 });

    expect(earnedBadges([rule({ metric: "streak", threshold: 7 })], learner)).toHaveLength(1);
    expect(earnedBadges([rule({ metric: "streak", threshold: 10 })], learner)).toHaveLength(0);
  });

  it("reports how close a learner is, without ever passing 1", async () => {
    const { badgeProgress } = await mod();
    expect(badgeProgress(rule({ threshold: 100 }), figures({ xp: 25 }))).toBe(0.25);
    expect(badgeProgress(rule({ threshold: 100 }), figures({ xp: 400 }))).toBe(1);
  });
});

describe("the list an owner keeps", () => {
  it("ships two rungs on each of the three figures", async () => {
    const { BadgeAPI } = await mod();
    const byMetric = BadgeAPI.current().reduce<Record<string, number>>((counts, rule) => {
      counts[rule.metric] = (counts[rule.metric] ?? 0) + 1;
      return counts;
    }, {});

    expect(byMetric).toEqual({ xp: 2, streak: 2, stars: 2 });
    expect(BadgeAPI.isEdited()).toBe(false);
  });

  it("puts a first rung within a first week", async () => {
    const { BadgeAPI, earnedBadges } = await mod();
    // A learner who has done a couple of lessons over three days should have
    // something on the shelf; an empty shelf is one nobody opens twice.
    const earned = earnedBadges(BadgeAPI.current(), {
      xp: 60,
      longestStreak: 3,
      starsEarned: 10,
    });
    expect(earned.map((r) => r.id)).toEqual(["first-steps", "three-in-a-row", "star-collector"]);
  });

  it("saves one badge list for the whole deployment when it changes", async () => {
    const { BadgeAPI } = await mod();
    BadgeAPI.add({
      label: "Century",
      description: "",
      icon: "trophy",
      metric: "xp",
      threshold: 100,
    });

    expect(saveRule).toHaveBeenCalledTimes(1);
    expect(saveRule.mock.calls[0][0]).toBe("badges");
    expect(BadgeAPI.find("century")?.threshold).toBe(100);
  });

  it("keeps two badges of the same name apart", async () => {
    const { BadgeAPI } = await mod();
    BadgeAPI.add({
      label: "Century",
      description: "",
      icon: "award",
      metric: "xp",
      threshold: 100,
    });
    BadgeAPI.add({
      label: "Century",
      description: "",
      icon: "award",
      metric: "stars",
      threshold: 5,
    });

    const ids = BadgeAPI.current().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("refuses a badge every learner would hold from their first second", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rules: [{ label: "Free", metric: "xp", threshold: 0 }] }),
    );
    const { BadgeAPI } = await mod();
    expect(BadgeAPI.current()[0].threshold).toBe(1);
  });

  it("drops a badge with no name, and a metric it does not measure", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rules: [
          { label: "   ", metric: "xp", threshold: 10 },
          { label: "Odd", metric: "moon-phase", threshold: 10 },
        ],
      }),
    );
    const { BadgeAPI } = await mod();
    const rules = BadgeAPI.current();

    expect(rules).toHaveLength(1);
    expect(rules[0].label).toBe("Odd");
    expect(rules[0].metric).toBe("xp");
  });

  it("keeps a picture drawn by the family, and defaults one that is missing", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rules: [
          { id: "drawn", label: "Drawn", icon: "art:gold-medal", metric: "xp", threshold: 10 },
          { id: "bare", label: "Bare", metric: "xp", threshold: 10 },
        ],
      }),
    );
    const { BadgeAPI } = await mod();

    // The `art:` prefix is what tells the icon apart from a built-in, so it has
    // to survive the round trip through storage and sync untouched.
    expect(BadgeAPI.find("drawn")?.icon).toBe("art:gold-medal");
    expect(BadgeAPI.find("bare")?.icon).toBe("award");
  });

  it("takes the list the deployment sends down", async () => {
    const { BadgeAPI } = await mod();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        rules: [{ id: "solo", label: "Solo", icon: "star", metric: "stars", threshold: 3 }],
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));

    expect(BadgeAPI.current()).toHaveLength(1);
    expect(BadgeAPI.find("solo")?.threshold).toBe(3);
  });

  it("puts the shipped badges back", async () => {
    const { BadgeAPI, BADGE_DEFAULTS } = await mod();
    BadgeAPI.remove("first-steps");
    expect(BadgeAPI.isEdited()).toBe(true);

    BadgeAPI.reset();
    expect(BadgeAPI.current()).toEqual(BADGE_DEFAULTS);
    expect(BadgeAPI.isEdited()).toBe(false);
  });
});

describe("the shelf a learner opens", () => {
  it("shows what is locked as well as what is won", async () => {
    const { badgeShelf } = await mod();
    const shelf = badgeShelf(
      [
        rule({ id: "easy", threshold: 10 }),
        rule({ id: "hard", threshold: 1000 }),
      ],
      figures({ xp: 50 }),
    );

    expect(shelf).toHaveLength(2);
    expect(shelf[0]).toMatchObject({ earned: true });
    expect(shelf[1]).toMatchObject({ earned: false, progress: 0.05 });
  });

  it("puts the nearest locked badge first among the rest", async () => {
    const { badgeShelf } = await mod();
    const shelf = badgeShelf(
      [
        rule({ id: "far", threshold: 1000 }),
        rule({ id: "near", threshold: 100 }),
      ],
      figures({ xp: 50 }),
    );

    expect(shelf.map((e) => e.rule.id)).toEqual(["near", "far"]);
  });

  it("names the one to go for, and how far off it is", async () => {
    const { nextBadge } = await mod();
    const next = nextBadge(
      [rule({ id: "done", threshold: 10 }), rule({ id: "next", metric: "stars", threshold: 25 })],
      figures({ xp: 50, starsEarned: 16 }),
    );

    expect(next?.rule.id).toBe("next");
    expect(next?.standing).toBe(16);
  });

  it("has nothing to go for once they are all won", async () => {
    const { nextBadge } = await mod();
    expect(nextBadge([rule({ threshold: 10 })], figures({ xp: 50 }))).toBeUndefined();
  });
});
