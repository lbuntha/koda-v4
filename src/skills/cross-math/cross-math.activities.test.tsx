import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, crossHints, slotWhere, type CrossMathParams } from "./activities/CrossMath";
import type { Puzzle } from "./internal/grid";

const grid = skill.activities.grid;
const settings = { praiseMs: 0 };

type Params = CrossMathParams & Record<string, unknown>;

const lessonParams = (id: string, seed: string): Params => {
  const lesson = skill.lessons.find((l) => l.id === id)!;
  const params = lesson.params as CrossMathParams;
  return { ...params, question: { ...params.question, seed } } as Params;
};

type H = ReturnType<typeof renderActivity>;
const box = (h: H, p: Puzzle, i: number) =>
  h.screen.getByRole("button", { name: new RegExp(`^${slotWhere(p.slots[i])},`) });

/** Puts `values` into the puzzle's slots the way a child does: box, then tile. */
function fillIn(h: H, p: Puzzle, values: string[]) {
  values.forEach((v, i) => {
    fireEvent.click(box(h, p, i));
    const slot = p.slots[i];
    if (slot.kind === "op") {
      const name = { "+": "plus", "-": "minus", "*": "times", "/": "divided by" }[v]!;
      fireEvent.click(h.screen.getByRole("button", { name: `Sign ${name}` }));
      return;
    }
    const tile = h.screen.getAllByRole("button", { name: new RegExp(`^Tile ${v}(,|$)`) })
      .find((b) => !(b as HTMLButtonElement).disabled)!;
    fireEvent.click(tile);
  });
}

describe("the cross math grid", () => {
  it("scores a filled, true grid once and moves on", async () => {
    const params = lessonParams("first-grid", "t1");
    const q = buildQuestion(params, 1, "x");
    const h = renderActivity(grid, { params, settings });
    expect(h.screen.getByRole("button", { name: /to fill$/ })).toHaveProperty("disabled", true);
    fillIn(h, q.puzzle, q.puzzle.answers);
    await h.press("Check");
    await h.settle();
    const answered = h.koda.only("learning.answered");
    expect(answered).toHaveLength(1);
    expect(JSON.stringify(answered[0].args)).toContain(q.expected!);
    h.unmount();
  });

  it("finishes a whole round", async () => {
    const params: Params = { ...lessonParams("first-grid", "round"), question: { ...lessonParams("first-grid", "round").question, questionsPerRound: 3 } };
    const h = renderActivity(grid, { params, settings });
    for (let i = 1; i <= 3; i += 1) {
      const q = buildQuestion(params, i, "x");
      fillIn(h, q.puzzle, q.puzzle.answers);
      await h.press("Check");
      await h.settle();
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("learning.answered")).toBe(3);
    h.unmount();
  });

  it("marks the wrong boxes, keeps the question, and takes a corrected answer", async () => {
    const params = lessonParams("three-gaps", "wrong");
    let q = buildQuestion(params, 1, "x");
    let seed = 0;
    // A grid whose first two answers differ, so swapping them is wrong.
    while (q.puzzle.answers[0] === q.puzzle.answers[1]) {
      seed += 1;
      q = buildQuestion({ ...params, question: { ...params.question, seed: `wrong${seed}` } }, 1, "x");
    }
    const used: Params = { ...params, question: { ...params.question, seed: seed ? `wrong${seed}` : "wrong" } };
    const h = renderActivity(grid, { params: used, settings });
    const swapped = q.puzzle.answers.slice();
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    fillIn(h, q.puzzle, swapped);
    await h.press("Check");
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toMatch(/not right/);
    expect(box(h, q.puzzle, 0).textContent).toContain("✗");

    await h.press("Try again");
    // Take the two swapped tiles back and put them right.
    fireEvent.click(box(h, q.puzzle, 0));
    fireEvent.click(box(h, q.puzzle, 1));
    fillIn(h, { ...q.puzzle, slots: q.puzzle.slots.slice(0, 2) }, q.puzzle.answers.slice(0, 2));
    await h.press("Check");
    await h.settle();
    const answers = h.koda.only("learning.answered");
    expect(answers).toHaveLength(2);
    expect(h.koda.only("learning.present").length).toBeGreaterThanOrEqual(2);
    h.unmount();
  });

  it("takes a tile back to the bank when its box is tapped", () => {
    const params = lessonParams("first-grid", "back");
    const q = buildQuestion(params, 1, "x");
    const h = renderActivity(grid, { params, settings });
    fillIn(h, q.puzzle, q.puzzle.answers.slice(0, 1));
    expect(box(h, q.puzzle, 0).getAttribute("aria-label")).toMatch(/Tap to take it back/);
    fireEvent.click(box(h, q.puzzle, 0));
    expect(box(h, q.puzzle, 0).getAttribute("aria-label")).toMatch(/empty$/);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("offers Start over only once something is placed, and it is not an answer", async () => {
    const params = lessonParams("three-gaps", "over");
    const q = buildQuestion(params, 1, "x");
    const h = renderActivity(grid, { params, settings });
    expect(h.screen.queryByRole("button", { name: /start over/i })).toBeNull();
    fillIn(h, q.puzzle, q.puzzle.answers.slice(0, 2));
    await h.press(/start over/i);
    q.puzzle.slots.forEach((_, i) => expect(box(h, q.puzzle, i).getAttribute("aria-label")).toMatch(/empty$/));
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("plays a missing-signs lesson with sign tiles that are never used up", async () => {
    const params = lessonParams("signs-and-numbers", "signs");
    const q = buildQuestion(params, 1, "x");
    expect(q.taskKind).toBe("cross_math_signs");
    const h = renderActivity(grid, { params, settings });
    fillIn(h, q.puzzle, q.puzzle.answers);
    await h.press("Check");
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("plays a big grid", async () => {
    const params = lessonParams("six-gaps", "big");
    const q = buildQuestion(params, 1, "x");
    expect(q.puzzle.size).toBe(3);
    const h = renderActivity(grid, { params, settings });
    fillIn(h, q.puzzle, q.puzzle.answers);
    await h.press("Check");
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });
});

describe("hints", () => {
  const q = buildQuestion(lessonParams("four-gaps", "hints"), 1, "x");
  const empty = q.puzzle.slots.map(() => null);

  it("open with the lesson's tip and stop at three rungs", () => {
    const rungs = crossHints(q, empty, "TIP");
    expect(rungs[0]).toBe("TIP");
    expect(rungs.length).toBeLessThanOrEqual(3);
    expect(new Set(rungs).size).toBe(rungs.length);
  });

  it("follow the board as it is filled", () => {
    const before = crossHints(q, empty);
    const partly = q.puzzle.answers.map((a, i) => (i < 3 ? a : null));
    const after = crossHints(q, partly);
    expect(after).not.toEqual(before);
    // One gap left: the worked rung shows that line with a "?" in it.
    expect(after.join(" ")).toMatch(/\?/);
  });

  it("show the line with its gap, never with the answer filled in", () => {
    const one = q.puzzle.answers.map((a, i) => (i === 0 ? null : a));
    const worked = crossHints(q, one).at(-1)!;
    expect(worked).toMatch(/\?/);
  });

  it("say nothing more once every box is full", () => {
    expect(crossHints(q, q.puzzle.answers)).toEqual([]);
  });
});

describe("practice", () => {
  it("runs without hints or speech, across the whole round", async () => {
    const params = lessonParams("practice-first-grid", "prac");
    const h = renderActivity(grid, { params, settings });
    expect(h.screen.queryByRole("button", { name: /hint/i })).toBeNull();
    const total = (params.question?.questionsPerRound ?? 6);
    for (let i = 1; i <= total; i += 1) {
      const q = buildQuestion(params, i, "x");
      fillIn(h, q.puzzle, q.puzzle.answers);
      await h.press("Check");
      await h.settle();
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("speech.say"), "a practice round spoke").toBe(0);
    h.unmount();
  });
});

describe("feature switches", () => {
  const params = lessonParams("first-grid", "feat");
  const q = buildQuestion(params, 1, "x");

  const play = async (features: Record<string, boolean>) => {
    const h = renderActivity(grid, { params, settings, features });
    fillIn(h, q.puzzle, q.puzzle.answers);
    await h.press("Check");
    await h.settle();
    return h;
  };

  it("sound_chimes off: no sounds from the board", async () => {
    const on = await play({});
    expect(on.koda.only("sound.play").length).toBeGreaterThan(0);
    on.unmount();
    const off = await play({ sound_chimes: false });
    expect(off.koda.only("sound.play").filter((c) => c.args[0] === "pop")).toHaveLength(0);
    off.unmount();
  });

  it("haptic_feedback off: no vibration on check", async () => {
    const on = await play({});
    expect(on.koda.count("haptics.success")).toBeGreaterThan(0);
    on.unmount();
    const off = await play({ haptic_feedback: false });
    expect(off.koda.count("haptics.success")).toBe(0);
    off.unmount();
  });

  it("audio_speech off: no prompt read aloud and no read-aloud button", () => {
    const on = renderActivity(grid, { params, settings });
    expect(on.koda.count("speech.say")).toBeGreaterThan(0);
    on.unmount();
    const off = renderActivity(grid, { params, settings, features: { audio_speech: false } });
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });
});
