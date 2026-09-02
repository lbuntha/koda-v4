import { afterEach, describe, expect, it, vi } from "vitest";
import { renderActivity, type ActivityHarness, type RenderActivityOptions } from "../kit/testing";
import type { AnyActivityDefinition } from "../types";
import { skill } from ".";

/**
 * Every switch in the Skill Manager changes something.
 *
 * The manifest test next door proves each feature id is *asked about* somewhere.
 * That is the cheap half. This is the other half, and it is the one Phase 15
 * asked a person to walk through by hand: flip the switch and watch the round
 * behave differently. A manual pass proves it once, on the day; this proves it
 * on every run, which is what a switch nobody has touched for six months needs.
 *
 * Each flag is checked on an engine that actually reads it — a switch off in
 * `FrameFill` says nothing about `CountTray` — and both runs get the same draw,
 * so the only thing that can differ is the flag.
 */

const { tray, frames } = skill.activities;

interface Run {
  /** Everything the round put on screen. */
  text: string;
  /** How many times the round asked the host for something. */
  count: (call: string) => number;
}

/**
 * Play the same opening move twice, once per setting of one flag.
 *
 * One at a time and unmounted in between, because both harnesses query the same
 * document: two rounds mounted at once and a tap by label lands on whichever
 * rendered first, which reads exactly like a switch that did nothing.
 */
const compare = async (
  { activity, ...options }: RenderActivityOptions & { activity: AnyActivityDefinition },
  switchedOff: Record<string, boolean>,
  drive?: (h: ActivityHarness) => Promise<void>,
): Promise<{ on: Run; off: Run }> => {
  const play = async (extra: Record<string, boolean>): Promise<Run> => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const h = renderActivity(activity, {
      ...options,
      features: { ...options.features, ...extra },
    });
    await drive?.(h);
    const run: Run = { text: h.text(), count: (call) => h.koda.count(call) };
    h.unmount();
    vi.restoreAllMocks();
    return run;
  };
  return { on: await play({}), off: await play(switchedOff) };
};

/** The first thing a child can touch, which is what makes most flags visible. */
const tap = (pattern: RegExp) => async (h: ActivityHarness) => {
  const target = h.buttons().find((b) => pattern.test(b));
  expect(target, `nothing matching ${pattern} to tap`).toBeTruthy();
  await h.press(target!);
};

const inTheFrame = { activity: frames, params: { mode: "ten" }, level: 9 };
const onTheTray = { activity: tray, params: { mode: "count_all" }, level: 1 };
const tapACell = tap(/^Space \d+, empty$/);

afterEach(() => vi.restoreAllMocks());

describe("every feature toggle changes the round", () => {
  it("strategy_scaffold: the words under the model", async () => {
    const { on, off } = await compare(inTheFrame, { strategy_scaffold: false });
    expect(on.text).toContain("in the frame");
    expect(off.text, "the scaffold line survived its switch").not.toContain("in the frame");
  });

  it("running_total_badge: the count so far", async () => {
    // With the scaffold already off, the badge is the only number left to lose.
    const { on, off } = await compare(
      { ...inTheFrame, features: { strategy_scaffold: false } },
      { running_total_badge: false },
    );
    expect(off.text.length, "the total badge survived its switch").toBeLessThan(on.text.length);
  });

  it("counting_badges: the number on each object touched", async () => {
    const { on, off } = await compare(
      onTheTray,
      { counting_badges: false },
      tap(/^(First group|Second group) /),
    );
    expect(off.text.length, "the touched object was still numbered").toBeLessThan(on.text.length);
  });

  it("step_context_tags: how the step is framed", async () => {
    const { on, off } = await compare(inTheFrame, { step_context_tags: false });
    expect(on.text).toContain("Warm-up");
    expect(off.text, "the step tag survived its switch").not.toContain("Warm-up");
  });

  it("sound_chimes: the pop on a tap", async () => {
    const { on, off } = await compare(inTheFrame, { sound_chimes: false }, tapACell);
    expect(on.count("sound.play")).toBeGreaterThan(0);
    expect(off.count("sound.play"), "a silenced skill played a chime").toBe(0);
  });

  it("haptic_feedback: the pulse on a tap", async () => {
    const { on, off } = await compare(inTheFrame, { haptic_feedback: false }, tapACell);
    expect(on.count("haptics.tap")).toBeGreaterThan(0);
    expect(off.count("haptics.tap"), "a silenced skill vibrated").toBe(0);
  });

  it("audio_speech: the number said as a counter lands", async () => {
    const { on, off } = await compare(inTheFrame, { audio_speech: false }, tapACell);
    expect(on.count("speech.say")).toBeGreaterThan(0);
    expect(off.count("speech.say"), "a silenced skill spoke").toBe(0);
  });

  it("covers every feature the manifest declares", () => {
    // So a new switch cannot be added without a check that it does anything.
    const covered = new Set([
      "strategy_scaffold",
      "running_total_badge",
      "counting_badges",
      "step_context_tags",
      "sound_chimes",
      "haptic_feedback",
      "audio_speech",
    ]);
    for (const feature of skill.features) {
      expect(covered.has(feature.id), `${feature.id} has no toggle test`).toBe(true);
    }
  });
});
