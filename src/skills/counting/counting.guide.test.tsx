import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  cueFor,
  isWander,
  levelFor,
  nextTarget,
  waitMs,
  GUIDE_DEFAULTS,
} from "./internal/guide/countGuide";

/**
 * The offline coach, on the one lesson that asks for one.
 *
 * Two halves, for the same reason the hint tests are in two halves. The first
 * is arithmetic — which object is next, how long to wait, which rung — and it
 * needs no screen. The second drives the activity the way a stuck five-year-old
 * does: stops tapping, taps the same rocket twice, jumps to the end of the row.
 *
 * What both are guarding is the thing that makes this coach worth having: it is
 * *offline*. Nothing here awaits a request, and a test that passes with the
 * network unplugged is the whole claim.
 */

const { orbit } = skill.activities;

/** `count-in-a-row`, with the count pinned so a cue can be read word for word. */
const guidedParams = (extra: Record<string, unknown> = {}) => {
  const lesson = skill.lessons.find((l) => l.id === "count-in-a-row")!;
  const params = lesson.params as Record<string, unknown>;
  return {
    ...params,
    question: {
      ...(params.question as Record<string, unknown>),
      countRange: [4, 4],
      settleMs: 0,
    },
    ...extra,
  };
};

/** The objects on screen, in the order they are drawn. */
const objects = () => screen.getAllByRole("button", { name: /^rocket \d/ });
const object = (n: number) => objects()[n];

const tap = (n: number) =>
  act(() => {
    object(n).click();
  });

/** Nothing happens for this long. */
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const coaching = (): string | null =>
  screen.queryByText(/Koda is helping/)?.closest("[role=status]")?.textContent ?? null;

/** Every cue Koda has raised, as the learning log recorded it. */
const cueLevels = (h: ActivityHarness): (number | undefined)[] =>
  h.koda
    .only("learning.supportUsed")
    .filter((call) => call.args[0] === "walkthrough")
    .map((call) => call.args[1] as number | undefined);

describe("what the coach decides", () => {
  it("points at the leftmost object with no number on it", () => {
    expect(nextTarget(4, [])).toBe(0);
    expect(nextTarget(4, [0, 1])).toBe(2);
    // A child who jumped to the end is sent back, not forward.
    expect(nextTarget(4, [0, 3])).toBe(1);
    expect(nextTarget(4, [0, 1, 2, 3]), "nothing left to point at").toBe(-1);
  });

  it("tells hopping about the row from counting it in either direction", () => {
    expect(isWander([], 2), "the first tap can be anywhere").toBe(false);
    expect(isWander([0], 1)).toBe(false);
    expect(isWander([0], 3)).toBe(true);
    // Steadily right to left is counting in order, and must not be corrected.
    expect(isWander([3, 2], 1)).toBe(false);
  });

  it("points along the route the child is taking, not the one the lesson prefers", () => {
    expect(nextTarget(4, [3, 2]), "carrying on leftwards").toBe(1);
    expect(nextTarget(4, [0, 1]), "carrying on rightwards").toBe(2);
    // Rightwards, with no row left that way: they skipped one, so send them back.
    expect(nextTarget(4, [0, 3])).toBe(1);
  });

  it("grows less patient as a question goes on, but never nags", () => {
    const first = waitMs({}, { tapped: 0, shown: 0 });
    expect(first, "seven seconds to make a start").toBe(GUIDE_DEFAULTS.startMs);
    expect(
      waitMs({}, { tapped: 2, shown: 0 }),
      "shorter once they are going — the pause means a lost count, not a blank start",
    ).toBeLessThan(first);
    expect(waitMs({}, { tapped: 2, shown: 3 })).toBe(GUIDE_DEFAULTS.floorMs);
    expect(waitMs({ startMs: 1000 }, { tapped: 0, shown: 0 }), "a lesson may tune it").toBe(
      GUIDE_DEFAULTS.floorMs,
    );
  });

  it("starts gently, and climbs only where gentle has already failed", () => {
    expect(levelFor({ shown: 0, coachedQuestions: 0 })).toBe(1);
    expect(levelFor({ shown: 1, coachedQuestions: 0 })).toBe(2);
    // Two coached questions in: this child is past being told the gentlest thing.
    expect(levelFor({ shown: 0, coachedQuestions: 2 })).toBe(2);
    expect(levelFor({ shown: 5, coachedQuestions: 0 }), "three rungs, no more").toBe(3);
  });

  it("says the number the child is about to reach, not the one they said", () => {
    const words = cueFor({
      reason: "stalled",
      level: 1,
      count: 4,
      tapped: 2,
      target: 2,
      item: "rocket",
    });
    expect(words.text).toContain("You have counted 2");
    expect(words.text).toContain('say "three"');
    expect(words.target, "rung one moves nothing on screen").toBe(-1);

    const pointed = cueFor({
      reason: "stalled",
      level: 2,
      count: 4,
      tapped: 2,
      target: 2,
      item: "rocket",
    });
    expect(pointed.target, "rung two lights the object up").toBe(2);
    expect(pointed.text).toContain("rocket");
  });

  it("names the total only on the last object, where the total is the count made", () => {
    const middle = cueFor({ reason: "stalled", level: 3, count: 4, tapped: 1, target: 1, item: "fish" });
    expect(middle.text).not.toContain("how many there are");

    const last = cueFor({ reason: "stalled", level: 3, count: 4, tapped: 3, target: 3, item: "fish" });
    expect(last.text).toContain('say "four"');
    expect(last.text).toContain("how many there are");
  });

  it("speaks a line short enough to have been recorded, whatever it shows", () => {
    for (const item of ["rocket", "butterfly", "crown"]) {
      for (let tapped = 0; tapped < 4; tapped += 1) {
        for (const level of [1, 2, 3] as const) {
          const cue = cueFor({ reason: "stalled", level, count: 4, tapped, target: tapped, item });
          expect(cue.text, "the screen gets the noun — drawing it is free").toContain(item);
          expect(cue.say, "the voice does not: eight nouns is not a set anybody records").not.toContain(
            item,
          );
        }
      }
    }
  });
});

describe("the coach on screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The row is four rockets, every time: a cue can then be read word for word.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("leaves a child who is counting alone", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    tap(0);
    wait(2000);
    tap(1);
    wait(2000);

    expect(coaching(), "a pause between taps is thinking, not being stuck").toBeNull();
    expect(cueLevels(h)).toEqual([]);
    h.unmount();
  });

  it("steps in when the counting stops, and says where to start", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });
    const before = h.koda.count("speech.say");

    wait(GUIDE_DEFAULTS.startMs - 500);
    expect(coaching(), "not before the child has had time to think").toBeNull();

    wait(1000);
    expect(coaching()).toContain("far left");
    expect(cueLevels(h), "reported as help given, at rung one").toEqual([1]);

    const said = h.koda.only("speech.say").slice(before).at(-1)?.args[0];
    expect(said, "the recorded line, not the one with the noun in it").toBe(
      "Start at the very left. Touch it and say one.",
    );
    h.unmount();
  });

  it("answers a second tap on a counted object at once, and lights the next one", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    tap(0);
    tap(0);

    expect(coaching(), "no clock: the child is acting on a wrong idea now").toContain(
      "already has a number",
    );
    expect(cueLevels(h), "the badges are already on screen — first, say so").toEqual([1]);
    expect(
      screen.queryAllByRole("button", { name: /touch this one next/ }),
      "rung one moves nothing",
    ).toHaveLength(0);
    h.unmount();
  });

  it("climbs to walking them through it, and the light follows", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    tap(0);
    tap(0); // told
    tap(0); // shown
    tap(0); // walked
    expect(cueLevels(h)).toEqual([1, 2, 3]);
    expect(coaching()).toContain("glowing");

    // Everything that is not next steps back — but nothing is disabled.
    expect(object(2).className, "hushed, not hidden").toContain("opacity-40");
    expect((object(2) as HTMLButtonElement).disabled).toBe(false);

    tap(1);
    expect(object(2).getAttribute("aria-label"), "the light moved on with them").toContain(
      "touch this one next",
    );
    expect(coaching(), "and stays until the question is done").toContain("glowing");
    h.unmount();
  });

  it("gets quicker on a child who has already needed it", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    wait(GUIDE_DEFAULTS.startMs);
    expect(cueLevels(h)).toEqual([1]);

    tap(0); // acted on it, so the cue goes away
    expect(coaching()).toBeNull();

    wait(GUIDE_DEFAULTS.betweenMs - GUIDE_DEFAULTS.hurryMs);
    expect(cueLevels(h), "the second wait is shorter than the first, and lands higher").toEqual([
      1, 2,
    ]);
    h.unmount();
  });

  it("goes away when the child says they are fine, and comes back patient", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    wait(GUIDE_DEFAULTS.startMs);
    expect(coaching()).not.toBeNull();

    act(() => {
      screen.getByRole("button", { name: /Got it/i }).click();
    });
    expect(coaching()).toBeNull();

    wait(GUIDE_DEFAULTS.betweenMs - GUIDE_DEFAULTS.hurryMs);
    expect(cueLevels(h), "putting it away buys back the full wait").toEqual([1]);
    wait(GUIDE_DEFAULTS.startMs);
    expect(cueLevels(h), "but it does come back").toEqual([1, 2]);
    h.unmount();
  });

  it("keeps the lesson's own method behind Back and Next", () => {
    const lesson = skill.lessons.find((l) => l.id === "count-in-a-row")!;
    const [firstStep] = (lesson.params as { play: { stepByStep: string[] } }).play.stepByStep;
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    wait(GUIDE_DEFAULTS.startMs);
    expect(coaching(), "page one is the one thing to do next").toContain("far left");
    expect(coaching()).not.toContain(firstStep);

    act(() => {
      screen.getByRole("button", { name: "Next" }).click();
    });
    expect(coaching(), "and how it is done is one press away").toContain(firstStep);
    h.unmount();
  });

  it("holds off while the child is reading a hint they asked for", () => {
    const h = renderActivity(orbit, { params: guidedParams(), level: 1 });

    act(() => {
      screen.getByRole("button", { name: /^Hint$/ }).click();
    });
    wait(GUIDE_DEFAULTS.startMs * 2);

    expect(coaching(), "one voice at a time").toBeNull();
    expect(cueLevels(h)).toEqual([]);
    h.unmount();
  });

  it("stays out of a lesson that did not ask for it", () => {
    const h = renderActivity(orbit, {
      params: guidedParams({ guide: { enabled: false } }),
      level: 1,
    });

    wait(GUIDE_DEFAULTS.startMs * 3);
    tap(0);
    tap(0);

    expect(coaching()).toBeNull();
    expect(cueLevels(h)).toEqual([]);
    h.unmount();
  });

  it("stays out when a parent has switched it off", () => {
    const h = renderActivity(orbit, {
      params: guidedParams(),
      level: 1,
      features: { guide_coach: false },
    });

    wait(GUIDE_DEFAULTS.startMs * 3);
    expect(coaching()).toBeNull();
    h.unmount();
  });

  it("is shown even where it cannot be heard", () => {
    const h = renderActivity(orbit, {
      params: guidedParams(),
      level: 1,
      features: { audio_speech: false },
    });
    const before = h.koda.count("speech.say");

    wait(GUIDE_DEFAULTS.startMs);

    expect(coaching(), "a silent lesson is not an unguided one").toContain("far left");
    expect(h.koda.count("speech.say")).toBe(before);
    h.unmount();
  });
});
