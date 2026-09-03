import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which lessons a plan pays for.
 *
 * The rule has three inputs — the operator's switch, the operator's count, and
 * the family's plan — and getting any of them backwards is the kind of bug that
 * either gives the course away or locks a paying family out of it. Every case
 * here is one of those two failures.
 *
 * Modules are imported inside each test, after the stores have been seeded:
 * `skillStore` and `billing` both read `localStorage` at import time.
 */

const bundled = {
  id: "counting",
  name: "Counting Quest",
  version: "1.0.0",
  description: "Count",
  category: "core" as const,
  author: "Koda",
  isEnabled: true,
  features: [
    { id: "premium_lessons", name: "Premium", description: "Charge", isEnabled: false },
  ],
  settings: { freeLessons: 10 },
};

/** The counting skill's own lessons, in course order. What "level N" counts. */
const countingLevels = async (): Promise<number[]> => {
  const { getSkillLessons } = await import("../curriculum");
  return getSkillLessons("counting", { age: 99, showAllSkills: true } as never).map(
    (l) => l.levelNumber,
  );
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
});

/** Seed the store, optionally turning the switch on and setting the count. */
const setup = async (opts: { charging?: boolean; free?: number } = {}) => {
  const { SkillStoreAPI } = await import("./skillStore");
  SkillStoreAPI.registerSkill({
    ...bundled,
    features: [{ ...bundled.features[0], isEnabled: opts.charging ?? false }],
    settings: { freeLessons: opts.free ?? 10 },
  } as never);
  return import("./premiumLessons");
};

/** Put the family on a plan that includes the full course. */
const onPaidPlan = async () => {
  const { Billing, FREE_ENTITLEMENTS } = await import("./billing");
  Billing.adopt({ ...FREE_ENTITLEMENTS, planId: "family", features: ["course.premium"] });
};

describe("a skill that is not charging", () => {
  it("keeps every lesson free, whatever the count says", async () => {
    const premium = await setup({ charging: false, free: 1 });
    const levels = await countingLevels();

    // `freeLessons: 1` would make almost everything paid if the switch were
    // read second. It is read first, so a deployment that sells nothing is
    // untouched by whatever number happens to be sitting in the setting.
    for (const levelNumber of levels) {
      expect(premium.isPremiumLesson({ skillId: "counting", levelNumber })).toBe(false);
    }
    expect(premium.premiumFrom("counting")).toBe(Infinity);
  });
});

describe("a skill charging from level 11", () => {
  it("gives away the first ten and charges for the rest", async () => {
    const premium = await setup({ charging: true, free: 10 });
    const levels = await countingLevels();
    expect(levels.length).toBeGreaterThan(11);

    const paid = (n: number) =>
      premium.isPremiumLesson({ skillId: "counting", levelNumber: levels[n - 1] });

    expect(paid(1)).toBe(false);
    expect(paid(10)).toBe(false);
    expect(paid(11)).toBe(true);
    expect(paid(levels.length)).toBe(true);
  });

  it("counts positions in the skill, not level numbers in the course", async () => {
    /* Addition's eleventh lesson is course level 26. An operator setting "10
       free" is counting the path in front of them, so a rule that compared
       `levelNumber` to the count would give addition away entirely. */
    const { SkillStoreAPI } = await import("./skillStore");
    SkillStoreAPI.registerSkill({
      ...bundled,
      id: "addition",
      name: "Addition",
      features: [{ ...bundled.features[0], isEnabled: true }],
      settings: { freeLessons: 10 },
    } as never);
    const premium = await import("./premiumLessons");
    const { getSkillLessons } = await import("../curriculum");
    const levels = getSkillLessons("addition", { age: 99, showAllSkills: true } as never);

    expect(levels[0].levelNumber).toBeGreaterThan(10);
    expect(premium.isPremiumLesson({ skillId: "addition", levelNumber: levels[9].levelNumber }))
      .toBe(false);
    expect(premium.isPremiumLesson({ skillId: "addition", levelNumber: levels[10].levelNumber }))
      .toBe(true);
  });

  it("locks the paid lessons for a free family and none of them for a paying one", async () => {
    const premium = await setup({ charging: true, free: 10 });
    const levels = await countingLevels();
    const eleventh = { skillId: "counting", levelNumber: levels[10] };

    expect(premium.premiumLocked(eleventh)).toBe(true);

    await onPaidPlan();
    expect(premium.isPremiumLesson(eleventh)).toBe(true);
    expect(premium.premiumLocked(eleventh)).toBe(false);
  });
});

describe("a count that is not a count", () => {
  it("reads a blank or negative setting as nothing free, not everything", async () => {
    /* The setting comes from a form. Both of these used to be `NaN` and
       `-1`, and either one silently inverted the rule. */
    for (const free of [Number.NaN, -1] as number[]) {
      vi.resetModules();
      localStorage.clear();
      const premium = await setup({ charging: true, free });
      const levels = await countingLevels();

      expect(premium.freeLessonCount("counting")).toBe(0);
      expect(premium.isPremiumLesson({ skillId: "counting", levelNumber: levels[0] })).toBe(true);
    }
  });

  it("gives the whole skill away when the count covers every lesson", async () => {
    const premium = await setup({ charging: true, free: 999 });
    const levels = await countingLevels();
    for (const levelNumber of levels) {
      expect(premium.isPremiumLesson({ skillId: "counting", levelNumber })).toBe(false);
    }
  });
});

describe("a lesson the course does not have", () => {
  it("is not premium, so a stale level number cannot lock anything", async () => {
    const premium = await setup({ charging: true, free: 10 });
    expect(premium.isPremiumLesson({ skillId: "counting", levelNumber: 9999 })).toBe(false);
    expect(premium.isPremiumLesson({ skillId: "no-such-skill", levelNumber: 1 })).toBe(false);
  });
});
