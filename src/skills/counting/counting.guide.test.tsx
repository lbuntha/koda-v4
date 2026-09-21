import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import {
  isWander,
  nextCell,
  nextTarget,
  skippedTopRow,
} from "./internal/guide/countGuide";
import { GUIDE_DEFAULTS, levelFor, waitMs } from "../kit";

/**
 * The coach, across every technique counting teaches.
 *
 * Three halves, which is the shape the thing itself has. The arithmetic — which
 * object is next, how long to wait, which rung — needs no screen. The behaviour
 * is driven the way a stuck five-year-old drives it: stops moving, taps the
 * same rocket twice, fills the bottom row first. And the last part is the one
 * that matters most across fifteen lessons: that all five engines coach the
 * *same way*, because a child should only have to learn this once.
 *
 * What every one of these guards is that the coach is offline. Nothing here
 * awaits a request, and a suite that passes with the network unplugged is the
 * whole claim.
 */

const { orbit, subitize, tenframe, numberline, base10 } = skill.activities;

/** A lesson's real params, with the counts pinned so copy can be read exactly. */
const lessonParams = (id: string, question: Record<string, unknown> = {}) => {
  const lesson = skill.lessons.find((l) => l.id === id)!;
  const params = lesson.params as Record<string, unknown>;
  return {
    ...params,
    question: { ...(params.question as Record<string, unknown>), ...question },
  };
};

/** Rung one of every ladder: the lesson's own kidTip. */
const kidTipOf = (id: string) =>
  (skill.lessons.find((l) => l.id === id)!.params as { play: { kidTip: string } }).play.kidTip;

const objects = () => screen.getAllByRole("button", { name: /^rocket \d/ });
const tap = (n: number) =>
  act(() => {
    objects()[n].click();
  });
const press = (name: RegExp | string) =>
  act(() => {
    screen.getByRole("button", { name }).click();
  });

/** Nothing happens for this long. */
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const coaching = (): string | null =>
  screen.queryByText(/Koda is helping/)?.closest("[role=status]")?.textContent ?? null;

/** Every cue raised, as the learning log recorded it. */
const cues = (h: ActivityHarness, kind = "walkthrough"): (number | undefined)[] =>
  h.koda
    .only("learning.supportUsed")
    .filter((call) => call.args[0] === kind)
    .map((call) => call.args[1] as number | undefined);

describe("what the coach decides", () => {
  it("points at the next thing along the route the learner is taking", () => {
    expect(nextTarget(4, [])).toBe(0);
    expect(nextTarget(4, [0, 1]), "carrying on rightwards").toBe(2);
    expect(nextTarget(4, [3, 2]), "carrying on leftwards").toBe(1);
    // Rightwards with no row left that way: they skipped one, so send them back.
    expect(nextTarget(4, [0, 3])).toBe(1);
    expect(nextTarget(4, [0, 1, 2, 3]), "nothing left to point at").toBe(-1);
  });

  it("tells hopping about a row from counting it in either direction", () => {
    expect(isWander([], 2), "the first tap can be anywhere").toBe(false);
    expect(isWander([0], 1)).toBe(false);
    expect(isWander([0], 3)).toBe(true);
    // Steadily right to left is counting in order, and must not be corrected.
    expect(isWander([3, 2], 1)).toBe(false);
  });

  it("fills a ten-frame in reading order, and knows when the top row was skipped", () => {
    const empty = Array<boolean>(10).fill(false);
    expect(nextCell(empty)).toBe(0);
    expect(nextCell([true, true, ...empty.slice(2)])).toBe(2);

    expect(skippedTopRow(empty, 2), "a top-row box is never a skip").toBe(false);
    expect(skippedTopRow(empty, 5), "the bottom row while the top is empty").toBe(true);
    const topFull = [true, true, true, true, true, ...Array<boolean>(5).fill(false)];
    expect(skippedTopRow(topFull, 5), "the bottom row once the top is full").toBe(false);
  });

  it("grows less patient as a question goes on, but never nags", () => {
    const first = waitMs({}, { started: false, shown: 0 });
    expect(first, "seven seconds to make a start").toBe(GUIDE_DEFAULTS.startMs);
    expect(
      waitMs({}, { started: true, shown: 0 }),
      "shorter once they are going — a pause then means a lost thread",
    ).toBeLessThan(first);
    expect(waitMs({}, { started: true, shown: 3 })).toBe(GUIDE_DEFAULTS.floorMs);
    expect(waitMs({ startMs: 1000 }, { started: false, shown: 0 }), "a lesson may tune it").toBe(
      GUIDE_DEFAULTS.floorMs,
    );
  });

  it("starts gently, and climbs only where gentle has already failed", () => {
    expect(levelFor({ shown: 0, coachedQuestions: 0 })).toBe(1);
    expect(levelFor({ shown: 1, coachedQuestions: 0 })).toBe(2);
    // Two coached questions in: this child is past the gentlest thing.
    expect(levelFor({ shown: 0, coachedQuestions: 2 })).toBe(2);
    expect(levelFor({ shown: 5, coachedQuestions: 0 }), "three rungs, no more").toBe(3);
  });
});

describe("the coach on screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Four rockets, every time: a cue can then be read word for word.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("leaves a learner who is working alone", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    tap(0);
    wait(2000);
    tap(1);
    wait(2000);

    expect(coaching(), "a pause between taps is thinking, not being stuck").toBeNull();
    expect(cues(h)).toEqual([]);
    h.unmount();
  });

  it("steps in when the counting stops, and says where to start", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    wait(GUIDE_DEFAULTS.startMs - 500);
    expect(coaching(), "not before the child has had time to think").toBeNull();

    wait(1000);
    // Rung one is the lesson's own kidTip: the strategy, in the lesson's words,
    // with no reference to the row on screen.
    expect(coaching()).toContain(kidTipOf("count-in-a-row"));
    expect(cues(h), "filed as help given, at rung one").toEqual([1]);
    h.unmount();
  });

  it("answers a second tap on a counted object at once", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    tap(0);
    tap(0);

    expect(coaching(), "no clock: the child is acting on a wrong idea now").not.toBeNull();
    expect(cues(h), "the badges are already on screen — first, say so").toEqual([1]);
    h.unmount();
  });

  it("climbs to walking them through it, and the light follows", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    tap(0);
    tap(0); // told
    tap(0); // shown
    tap(0); // walked
    expect(cues(h)).toEqual([1, 2, 3]);

    expect(objects()[1].getAttribute("aria-label")).toContain("touch this one next");
    tap(1);
    expect(
      objects()[2].getAttribute("aria-label"),
      "the light moved on with them rather than going out",
    ).toContain("touch this one next");
    h.unmount();
  });

  it("gets quicker on a learner who has already needed it", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    wait(GUIDE_DEFAULTS.startMs);
    expect(cues(h)).toEqual([1]);

    tap(0); // acted on it, so the cue goes away
    expect(coaching()).toBeNull();

    wait(GUIDE_DEFAULTS.betweenMs - GUIDE_DEFAULTS.hurryMs);
    expect(cues(h), "the second wait is shorter, and lands higher").toEqual([1, 2]);
    h.unmount();
  });

  it("goes away when the learner says they are fine, and comes back patient", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    wait(GUIDE_DEFAULTS.startMs);
    expect(coaching()).not.toBeNull();

    press(/Got it/i);
    expect(coaching()).toBeNull();

    wait(GUIDE_DEFAULTS.betweenMs - GUIDE_DEFAULTS.hurryMs);
    expect(cues(h), "putting it away buys back the full wait").toEqual([1]);
    wait(GUIDE_DEFAULTS.startMs);
    expect(cues(h), "but it does come back").toEqual([1, 2]);
    h.unmount();
  });

  it("keeps the lesson's own method behind Back and Next", () => {
    const lesson = skill.lessons.find((l) => l.id === "count-in-a-row")!;
    const [firstStep] = (lesson.params as { play: { stepByStep: string[] } }).play.stepByStep;
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
    });

    wait(GUIDE_DEFAULTS.startMs);
    expect(coaching(), "page one is the one thing to do next").not.toContain(firstStep);

    press("Next");
    expect(coaching(), "and how it is done is one press away").toContain(firstStep);
    h.unmount();
  });

  it("stays out of practice, where the scaffolding is the point", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("practice-orbit", { countRange: [4, 4], settleMs: 0, mode: "row" }),
      level: 16,
    });

    wait(GUIDE_DEFAULTS.startMs * 3);
    expect(coaching()).toBeNull();
    expect(cues(h)).toEqual([]);
    h.unmount();
  });

  it("is one help however it arrived, on or off the parent's switch", () => {
    /*
     * The switch answers "does Koda step in by itself", and nothing else.
     *
     * It used to answer "what does help look like" as well: with the coach off,
     * the Hint button fell back to the old hint card — same three rungs, a
     * different panel, different buttons. So a family who turned off the
     * interruptions also changed the thing their child had learned to read, and
     * one ladder had two faces.
     */
    const look = (features: Record<string, boolean>) => {
      const h = renderActivity(orbit, {
        params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
        level: 1,
        features,
      });
      press(/^Hint$/);
      const shown = coaching();
      const controls = h
        .buttons()
        .filter((b) => /Got it|More help|Back|Next|Hide hint/.test(b))
        .sort();
      h.unmount();
      return { shown, controls };
    };

    const on = look({});
    const off = look({ guide_coach: false });

    expect(on.shown, "the Hint button did not open the coach").not.toBeNull();
    expect(off.shown, "with the coach off, Hint opened something else").not.toBeNull();
    expect(off.controls, "the same help offered different controls").toEqual(on.controls);
    expect(off.controls).not.toContain("More help");
  });

  it("stays out when a parent has switched it off", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
      features: { guide_coach: false },
    });

    wait(GUIDE_DEFAULTS.startMs * 3);
    expect(coaching()).toBeNull();
    h.unmount();
  });

  it("is shown even where it cannot be heard", () => {
    const h = renderActivity(orbit, {
      params: lessonParams("count-in-a-row", { countRange: [4, 4], settleMs: 0 }),
      level: 1,
      features: { audio_speech: false },
    });
    const before = h.koda.count("speech.say");

    wait(GUIDE_DEFAULTS.startMs);

    expect(coaching(), "a silent lesson is not an unguided one").toContain(
      kidTipOf("count-in-a-row"),
    );
    expect(h.koda.count("speech.say")).toBe(before);
    h.unmount();
  });
});

describe("every technique is coached the same way", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** One lesson per engine, which is the whole of what a child meets. */
  const engines: [string, typeof orbit, string][] = [
    ["orbit", orbit, "count-in-a-row"],
    ["subitize", subitize, "quick-dot-groups"],
    ["tenframe", tenframe, "ten-frame-5-and-more"],
    ["numberline", numberline, "skip-counting-by-2s-and-5s"],
    ["base10", base10, "make-a-ten"],
  ];

  for (const [name, activity, lessonId] of engines) {
    it(`${name}: waits, then speaks up in the same panel`, () => {
      const h = renderActivity(activity, { params: lessonParams(lessonId), level: 1 });

      wait(GUIDE_DEFAULTS.startMs - 1000);
      expect(coaching(), `${name} interrupted a learner who was still thinking`).toBeNull();

      wait(2000);
      expect(coaching(), `${name} never stepped in`).not.toBeNull();
      expect(cues(h), `${name} did not file the help it gave`).toEqual([1]);
      h.unmount();
    });

    it(`${name}: the Hint button opens that same panel, not a second one`, () => {
      const h = renderActivity(activity, { params: lessonParams(lessonId), level: 1 });

      press(/^Hint$/);
      expect(coaching(), `${name} answered the Hint button with something else`).not.toBeNull();
      // Asked for, not offered — the log has to be able to tell them apart.
      expect(cues(h, "hint")).toEqual([1]);
      expect(cues(h, "walkthrough")).toEqual([]);

      press(/^Hide hint$/);
      expect(coaching(), `${name} could not put its help away`).toBeNull();
      h.unmount();
    });
  }
});
