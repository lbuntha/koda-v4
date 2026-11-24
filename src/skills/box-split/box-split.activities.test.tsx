import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildBoxQuestion, type BoxSplitParams } from "./activities/BoxSplit";
import { candidatesFor, judge, nextBox, sameRect, type Puzzle, type Rect } from "./internal/rules";

const board = skill.activities.board;
const settings = { praiseMs: 0 };
type H = ReturnType<typeof renderActivity>;

const paramsFor = (question: BoxSplitParams["question"], seed: string): BoxSplitParams & Record<string, unknown> => ({
  question: { questionsPerRound: 1, ...question, seed },
});

/** The puzzle the screen shows for this seed — the same generator, the same key. */
const puzzleFor = (params: BoxSplitParams, index = 1): Puzzle => buildBoxQuestion(params, index, params.question?.seed).puzzle;

const square = (h: H, n: number, i: number) =>
  h.screen.getByRole("gridcell", { name: new RegExp(`^Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}(,|$)`) });

/** Tap one corner of a box, then the other — as a child without dragging would. */
function draw(h: H, n: number, b: Rect) {
  fireEvent.click(square(h, n, b.r * n + b.c));
  fireEvent.click(square(h, n, (b.r + b.h - 1) * n + b.c + b.w - 1));
}

/** A box of the right size for some number, in the wrong place: a wrong answer. */
function wrongBox(p: Puzzle): Rect | null {
  const free = new Int16Array(p.n * p.n).fill(-1);
  for (let k = 0; k < p.clues.length; k++) {
    const other = candidatesFor(p, k, free).find((b) => !sameRect(b, p.answer[k]));
    if (other && judge(p, other, p.clues.map(() => null)).kind === "wrong") return other;
  }
  return null;
}

describe("the Box Split board", () => {
  it("takes the right boxes one by one, and the last one finishes the puzzle as one right answer", async () => {
    const params = paramsFor({ size: 5, maxArea: 5, technique: "single-fit" }, "whole");
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    p.answer.forEach((b, k) => {
      draw(h, p.n, b);
      if (k < p.answer.length - 1) expect(h.koda.count("learning.answered")).toBe(0);
    });
    await h.settle();
    const answered = h.koda.only("learning.answered");
    expect(answered).toHaveLength(1);
    expect(JSON.stringify(answered[0].args)).toContain('"correct":true');
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("calls a right-sized box in the wrong place a wrong answer, then takes the right one", async () => {
    let seed = 0;
    let params = paramsFor({ size: 5, maxArea: 6, technique: "single-fit" }, `wrong-${seed}`);
    let bad = wrongBox(puzzleFor(params));
    while (!bad && seed < 50) {
      seed += 1;
      params = paramsFor({ size: 5, maxArea: 6, technique: "single-fit" }, `wrong-${seed}`);
      bad = wrongBox(puzzleFor(params));
    }
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    draw(h, p.n, bad!);
    await h.settle();
    expect(h.text()).toMatch(/is the right size, but/);
    await h.press(/try again/i);
    // The wrong box does not stay: nothing is drawn yet.
    expect(h.screen.queryAllByTestId("box-drawn")).toHaveLength(0);
    for (const b of p.answer) draw(h, p.n, b);
    await h.settle();
    const answers = h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
    expect(answers).toHaveLength(2);
    expect(answers[0]).toContain('"correct":false');
    expect(answers[1]).toContain('"correct":true');
    h.unmount();
  });

  it("refuses a box the rules forbid with its reason, and records no answer", async () => {
    const params = paramsFor({ size: 5, maxArea: 5, technique: "single-fit" }, "refuse");
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    draw(h, p.n, { r: 0, c: 0, h: 5, w: 5 });
    await h.settle();
    expect(h.text()).toMatch(/two numbers/);
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.screen.queryAllByTestId("box-drawn")).toHaveLength(0);
    h.unmount();
  });

  it("shows the size of a tapped corner, and a 1-square box from tapping one square twice", () => {
    const params = paramsFor({ size: 4, maxArea: 4, technique: "single-fit" }, "corner");
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    fireEvent.click(square(h, p.n, 0));
    expect(square(h, p.n, 0).getAttribute("aria-selected")).toBe("true");
    expect(h.screen.getByTestId("box-live").textContent).toContain("1 × 1 = 1");
    expect(h.text()).toMatch(/Now tap the other corner/);
    h.unmount();
  });

  it("lights the next box on the last hint, and it is a right one", async () => {
    const params = paramsFor({ size: 6, maxArea: 8, minArea: 2, technique: "single-fit" }, "hint");
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    expect(h.screen.queryByTestId("box-hint")).toBeNull();
    await h.press(/hint/i);
    expect(h.text()).toMatch(/Find a number that has only one box that fits/);
    await h.press("More help");
    expect(h.screen.queryByTestId("box-hint")).toBeNull();
    await h.press("More help");
    const glow = h.screen.getByTestId("box-hint");
    const next = nextBox(p, p.clues.map(() => null))!;
    const pct = 100 / p.n;
    expect(glow.style.left).toBe(`${next.box.c * pct}%`);
    expect(glow.style.top).toBe(`${next.box.r * pct}%`);
    expect(h.text()).toMatch(new RegExp(`${next.box.h} × ${next.box.w} = ${next.box.h * next.box.w}`));
    h.unmount();
  });

  it("starts over without counting it as an answer", async () => {
    const params = paramsFor({ size: 5, maxArea: 5, technique: "single-fit" }, "again");
    const p = puzzleFor(params);
    const h = renderActivity(board, { params, settings });
    expect(h.screen.queryByRole("button", { name: /start over/i })).toBeNull();
    draw(h, p.n, p.answer[0]);
    expect(h.screen.getAllByTestId("box-drawn")).toHaveLength(1);
    await h.press(/start over/i);
    expect(h.screen.queryAllByTestId("box-drawn")).toHaveLength(0);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("draws dots under the numbers for counting lessons only", () => {
    const dots = renderActivity(board, { params: paramsFor({ size: 4, maxArea: 4, dots: true }, "d"), settings });
    expect(dots.screen.queryAllByTestId("box-dots").length).toBeGreaterThan(0);
    dots.unmount();
    const plain = renderActivity(board, { params: paramsFor({ size: 4, maxArea: 4 }, "d"), settings });
    expect(plain.screen.queryAllByTestId("box-dots")).toHaveLength(0);
    plain.unmount();
  });

  it("shows a clock on timed lessons only", () => {
    const timed = renderActivity(board, { params: paramsFor({ size: 5, maxArea: 5, timed: true }, "t"), settings });
    expect(timed.screen.getByTestId("box-clock").textContent).toMatch(/^\d+:\d\d$/);
    timed.unmount();
    const calm = renderActivity(board, { params: paramsFor({ size: 5, maxArea: 5 }, "t"), settings });
    expect(calm.screen.queryByTestId("box-clock")).toBeNull();
    calm.unmount();
  });
});

describe("Box Split switches", () => {
  it("drag_draw off leaves tapping corners as the only way to draw", () => {
    const on = renderActivity(board, { params: paramsFor({ size: 4 }, "on"), settings });
    expect(on.screen.getByRole("grid").getAttribute("data-drag")).toBe("on");
    expect(on.text()).toMatch(/Drag from corner to corner/);
    on.unmount();
    const off = renderActivity(board, { params: paramsFor({ size: 4 }, "off"), settings, features: { drag_draw: false } });
    expect(off.screen.getByRole("grid").getAttribute("data-drag")).toBe("off");
    expect(off.text()).toMatch(/^(?!.*Drag from corner).*Tap one corner/s);
    off.unmount();
  });

  it("sound_chimes off plays no box sounds", () => {
    for (const enabled of [true, false]) {
      const params = paramsFor({ size: 5, maxArea: 5 }, "quiet");
      const p = puzzleFor(params);
      const h = renderActivity(board, { params, settings, features: { sound_chimes: enabled } });
      draw(h, p.n, p.answer[0]);
      expect(h.koda.count("sound.play") > 0).toBe(enabled);
      h.unmount();
    }
  });

  it("haptic_feedback off gives no vibration on a refused box", () => {
    for (const enabled of [true, false]) {
      const params = paramsFor({ size: 5, maxArea: 5 }, "buzz");
      const p = puzzleFor(params);
      const h = renderActivity(board, { params, settings, features: { haptic_feedback: enabled } });
      draw(h, p.n, { r: 0, c: 0, h: 5, w: 5 });
      expect(h.koda.count("haptics.pulse") > 0).toBe(enabled);
      h.unmount();
    }
  });
});

describe("Box Split practice", () => {
  it("has no hints and no read-aloud", () => {
    const lesson = skill.lessons.find((l) => l.id === "practice-counting")!;
    const h = renderActivity(board, { params: lesson.params as Record<string, unknown>, settings });
    expect(h.screen.queryByRole("button", { name: /hint/i })).toBeNull();
    expect(h.screen.queryByRole("button", { name: /read/i })).toBeNull();
    h.unmount();
  });
});
