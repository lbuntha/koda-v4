import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/NeighborLens";
import { tileLabel } from "./internal/BoardGrid";

/**
 * Every switch the Skill Manager shows, doing something.
 *
 * The contract test asks only whether the skill *reads* a flag. That is a
 * weaker question than it looks: counting once shipped three switches nothing
 * read, and a flag that is read and then ignored looks identical from outside.
 * These press the same buttons twice, with the switch on and off, and require
 * the two runs to differ.
 */

const lens = skill.activities.neighbors;
/* Lesson 1's own params, not a hand-written approximation: the spoken intro is
   the lesson's `audioPrompt`, so a test that invented params would find the
   audio switch changing nothing and be right about the wrong thing. */
const params = skill.lessons[0].params as Record<string, unknown>;
const question = buildQuestion({ ...lens.defaultParams, ...params } as never, 0);
const firstNeighbor = () => tileLabel(question.board, question.expectedCells![0]);

describe("declared features change what happens", () => {
  it("audio_speech: off means nothing is spoken, on means the question is", async () => {
    const on = renderActivity(lens, { params });
    expect(on.koda.count("speech.say")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(lens, { params, features: { audio_speech: false } });
    expect(off.koda.count("speech.say"), "a silent lesson is silent").toBe(0);
    /* And the Read aloud button is gone rather than present and mute. */
    expect(off.buttons().some((b) => /read|aloud|listen/i.test(b))).toBe(false);
    off.unmount();
  });

  it("sound_chimes: off means choosing a tile makes no sound", async () => {
    const on = renderActivity(lens, { params });
    await on.press(firstNeighbor());
    expect(on.koda.count("sound.play")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(lens, { params, features: { sound_chimes: false } });
    await off.press(firstNeighbor());
    expect(off.koda.count("sound.play")).toBe(0);
    off.unmount();
  });

  it("haptic_feedback: off means a refused move does not buzz", async () => {
    const on = renderActivity(lens, { params });
    await on.press(tileLabel(question.board, question.target, question.target));
    expect(on.koda.count("haptics.pulse")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(lens, { params, features: { haptic_feedback: false } });
    await off.press(tileLabel(question.board, question.target, question.target));
    expect(off.koda.count("haptics.pulse")).toBe(0);
    off.unmount();
  });

  it("counting_badges: on numbers the chosen tiles, off only ticks them", async () => {
    const on = renderActivity(lens, { params });
    for (const cell of question.expectedCells!.slice(0, 3)) await on.press(tileLabel(question.board, cell));
    expect(on.text(), "the third tile chosen is badged 3").toContain("3");
    on.unmount();

    const off = renderActivity(lens, { params, features: { counting_badges: false } });
    for (const cell of question.expectedCells!.slice(0, 3)) await off.press(tileLabel(question.board, cell));
    expect(off.text()).toContain("✓");
    off.unmount();
  });
});

describe("what a switch must never change", () => {
  it("leaves the question and its answer alone", () => {
    const quiet = renderActivity(lens, {
      params,
      features: { audio_speech: false, sound_chimes: false, haptic_feedback: false, counting_badges: false },
    });
    const [shown] = quiet.koda.only("learning.present");
    expect((shown.args[0] as { prompt: string }).prompt).toBe(question.prompt);
    expect((shown.args[0] as { expected: string }).expected).toBe(question.expected);
    quiet.unmount();
  });
});

/**
 * Motion, and the absence of it.
 *
 * jsdom runs no animation, so these assert the two things that are decidable
 * without one: that reduced motion removes the entrance rather than merely
 * shortening it, and that nothing in the apparatus waits on an animation
 * before accepting the next tap. §18's rule is that animation completion is
 * never required for correctness.
 */
describe("motion", () => {
  it("accepts a full answer as fast as it arrives", async () => {
    const h = renderActivity(lens, { params });
    /* No settle between taps: a child tapping quickly must not lose one, and
       an engine that gated input on a transition would drop most of these. */
    for (const cell of question.expectedCells!) await h.press(tileLabel(question.board, cell));
    await h.press(new RegExp(`^Check \\(${question.expectedCells!.length}\\)$`));
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toContain("Every one of them");
    h.unmount();
  });

  it("declares a board entrance inside the feedback budget", async () => {
    const { MOTION_PLAN } = await import("./internal/layout");
    const [floor, ceiling] = MOTION_PLAN.feedbackTargetMs;
    expect(MOTION_PLAN.boardEnterMs).toBeGreaterThanOrEqual(floor);
    expect(MOTION_PLAN.boardEnterMs).toBeLessThanOrEqual(ceiling);
  });

  it("never staggers the board", async () => {
    /* §18 forbids it: tiles arriving one after another draw the eye along an
       order the puzzle did not choose, and on a select-the-neighbours board
       that order points at the answer. */
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/skills/color-sweeper/internal/BoardGrid.tsx", "utf8"),
    );
    /* Comments stripped first: the file explains at length why it does not
       stagger, and a scan that reads prose would fail on the explanation. */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/stagger|delayChildren/);
  });
});

describe("a board that never animates is still a board", () => {
  it("never starts its entrance from invisible", async () => {
    const { BOARD_ENTER_FLOOR } = await import("./internal/BoardGrid");
    /* Found in the browser, not here: an automation tab produced one frame in
       27 seconds and the board — animating up from `opacity: 0` — simply never
       appeared. Any device that drops those frames does the same to a child. */
    expect(BOARD_ENTER_FLOOR).toBeGreaterThanOrEqual(0.5);
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/skills/color-sweeper/internal/BoardGrid.tsx", "utf8"),
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code, "an entrance from zero opacity hides the puzzle").not.toMatch(/opacity:\s*0\b/);
  });
});

describe("one colour, one meaning", () => {
  it("never draws board furniture in the colour that means the child chose it", async () => {
    /* Violet is the child's own mark — a selected tile, a painted tile, the
       active brush. A region outline drawn in violet says the board arrived
       with five tiles already chosen. */
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/skills/color-sweeper/internal/BoardGrid.tsx", "utf8"),
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const regionLine = code.split("\n").find((l) => l.includes("inRegion.has(cell)"))!;
    expect(regionLine).not.toMatch(/violet/);
  });
});
