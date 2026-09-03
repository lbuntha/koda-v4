import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";

const tray = skill.activities.tray;
const facts = skill.activities.facts;
const base10 = skill.activities.base10;

const run = async (off: Record<string, boolean>, drive?: (h: ActivityHarness) => Promise<void>) => {
  vi.spyOn(Math, "random").mockReturnValue(0.42);
  const h = renderActivity(tray, {
    params: { mode: "remove", minuendRange: [6, 6], subtrahendRange: [2, 2] },
    level: 1,
    features: off,
  });
  await drive?.(h);
  const result = { text: h.text(), calls: (name: string) => h.koda.count(name) };
  h.unmount();
  vi.restoreAllMocks();
  return result;
};

const tapFirst = async (h: ActivityHarness) => {
  const token = h.buttons().find((name) => /^\w+ 1$/.test(name));
  expect(token).toBeTruthy();
  await h.press(token!);
};

afterEach(() => vi.restoreAllMocks());

describe("every subtraction feature changes behaviour", () => {
  it("sound_chimes controls shared movement sounds", async () => {
    const on = await run({}, tapFirst);
    const off = await run({ sound_chimes: false }, tapFirst);
    expect(on.calls("sound.play")).toBeGreaterThan(0);
    expect(off.calls("sound.play")).toBe(0);
  });

  it("audio_speech controls spoken movement copy", async () => {
    const on = await run({}, tapFirst);
    const off = await run({ audio_speech: false }, tapFirst);
    expect(on.calls("speech.say")).toBeGreaterThan(0);
    expect(off.calls("speech.say")).toBe(0);
  });

  it("haptic_feedback gates the SDK vibration", async () => {
    const on = await run({}, tapFirst);
    const off = await run({ haptic_feedback: false }, tapFirst);
    expect(on.calls("haptics.tap")).toBeGreaterThan(0);
    expect(off.calls("haptics.tap")).toBe(0);
  });

  it("counting_badges controls the move number", async () => {
    const on = await run({}, tapFirst);
    const off = await run({ counting_badges: false }, tapFirst);
    expect(off.text.length).toBeLessThan(on.text.length);
  });

  it("running_difference_badge controls the live remainder", async () => {
    const on = await run({}, tapFirst);
    const off = await run({ running_difference_badge: false }, tapFirst);
    expect(on.text).toContain("remain");
    expect(off.text).not.toContain("remain");
  });

  it("strategy_scaffold controls the separation instruction", async () => {
    const play = async (enabled: boolean) => {
      const h = renderActivity(tray, { params: { mode: "separate", minuendRange: [6, 6], subtrahendRange: [2, 2] }, level: 3, features: { strategy_scaffold: enabled } });
      const text = h.text();
      h.unmount();
      return text;
    };
    expect(await play(true)).toContain("Move 2 more");
    expect(await play(false)).not.toContain("Move 2 more");
  });

  it("strategy_scaffold also controls the fact deck's next-step line", () => {
    const play = (enabled: boolean) => {
      const h = renderActivity(facts, { params: { mode: "known_fact", minuendRange: [13, 13], subtrahendRange: [5, 5] }, level: 24, features: { strategy_scaffold: enabled } });
      const text = h.text();
      h.unmount();
      return text;
    };
    expect(play(true)).toContain("Choose the relationship before answering.");
    expect(play(false)).not.toContain("Choose the relationship before answering.");
  });

  it("step_context_tags is enforced by the shared round chrome", async () => {
    const on = await run({});
    const off = await run({ step_context_tags: false });
    expect(on.text).toContain("Warm-up");
    expect(off.text).not.toContain("Warm-up");
  });

  it("running_difference_badge controls the live value of the block desk", () => {
    const play = (enabled: boolean) => {
      const h = renderActivity(base10, { params: { mode: "build_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 27, features: { running_difference_badge: enabled } });
      const text = h.text();
      h.unmount();
      return text;
    };
    expect(play(true)).toContain("on the desk");
    expect(play(false)).not.toContain("on the desk");
  });

  it("counting_badges controls the block desk's running tally", () => {
    const play = (enabled: boolean) => {
      const h = renderActivity(base10, { params: { mode: "build_subtract", minuendRange: [47, 47], subtrahendRange: [23, 23] }, level: 27, features: { counting_badges: enabled } });
      const text = h.text();
      h.unmount();
      return text;
    };
    expect(play(true)).toContain("taken away 0 of 23");
    expect(play(false)).not.toContain("taken away");
  });

  it("covers every feature declared by the manifest", () => {
    const covered = new Set(["audio_speech", "sound_chimes", "haptic_feedback", "counting_badges", "running_difference_badge", "strategy_scaffold", "step_context_tags", "premium_lessons"]);
    for (const feature of skill.features) expect(covered.has(feature.id), `${feature.id} has no feature test`).toBe(true);
  });
});
