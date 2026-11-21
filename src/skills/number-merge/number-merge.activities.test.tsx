import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { boardFor, refillRandom, setupOf, type MergeParams } from "./activities/Merge";
import { merge, moves, settle, type Board, type Resolved } from "./internal/rules";

const board = skill.activities.board;
const settings = { praiseMs: 0 };
type H = ReturnType<typeof renderActivity>;

const paramsFor = (question: MergeParams["question"], seed: string): MergeParams & Record<string, unknown> => ({
  question: { ...question, seed },
});

/**
 * Plays alongside the screen: the same board the child sees, changed by the
 * same merges. Lets a test pick a right (or wrong) pair without reading
 * answers off the component.
 */
class Mirror {
  board: Board;
  moves = 0;
  constructor(readonly s: Resolved, readonly seed: string) {
    this.board = boardFor(s, seed);
  }
  tile(h: H, i: number) {
    const n = this.board.size;
    return h.screen.getByRole("gridcell", { name: new RegExp(`^Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}:`) });
  }
  /** Tap `from`, then `to`, and keep the mirror in step. */
  tap(h: H, from: number, to: number) {
    fireEvent.click(this.tile(h, from));
    fireEvent.click(this.tile(h, to));
    const done = merge(this.s, this.board, from, to)!;
    if (done.verdict.kind !== "refuse") {
      this.moves += 1;
      this.board = settle(this.s, done.board, refillRandom(this.seed, this.moves)).board;
    }
    return done.verdict;
  }
  find(kind: "pop" | "grow" | "refuse") {
    return moves(this.s, this.board).find((m) => m.verdict.kind === kind);
  }
}

describe("the merge board", () => {
  it("pops a pair that makes the target, and records one right answer", async () => {
    const params = paramsFor({ mode: "bond", target: 10, size: 4, questionsPerRound: 3 }, "pop");
    const m = new Mirror(setupOf(params), "pop");
    const h = renderActivity(board, { params, settings });
    const pop = m.find("pop")!;
    expect(m.tap(h, pop.from, pop.to).kind).toBe("pop");
    await h.settle();
    const answered = h.koda.only("learning.answered");
    expect(answered).toHaveLength(1);
    expect(JSON.stringify(answered[0].args)).toContain('"correct":true');
    h.unmount();
  });

  it("takes a wrong pair as a wrong answer, then the right pair on the same question", async () => {
    const params = paramsFor({ mode: "bond", target: 10, size: 4, questionsPerRound: 2 }, "wrong");
    const m = new Mirror(setupOf(params), "wrong");
    const h = renderActivity(board, { params, settings });
    const bad = m.find("refuse")!;
    m.tap(h, bad.from, bad.to);
    await h.settle();
    expect(h.text()).toContain("not 10");
    await h.press(/try again/i);
    const pop = m.find("pop")!;
    m.tap(h, pop.from, pop.to);
    await h.settle();
    const answers = h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
    expect(answers).toHaveLength(2);
    expect(answers[0]).toContain('"correct":false');
    expect(answers[1]).toContain('"correct":true');
    h.unmount();
  });

  it("finishes a round of pops on one board", async () => {
    const params = paramsFor({ mode: "bond", target: 5, size: 3, show: "dots", questionsPerRound: 4 }, "round");
    const m = new Mirror(setupOf(params), "round");
    const h = renderActivity(board, { params, settings });
    for (let k = 0; k < 4; k += 1) {
      const pop = m.find("pop")!;
      m.tap(h, pop.from, pop.to);
      await h.settle();
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("learning.answered")).toBe(4);
    h.unmount();
  });

  it("in a building mode, grows without answering and refuses going over with a reason", async () => {
    const params = paramsFor({ mode: "sum", target: 10, max: 5, size: 4, questionsPerRound: 1 }, "build");
    const s = setupOf(params);
    const m = new Mirror(s, "build");
    const h = renderActivity(board, { params, settings });
    const grow = m.find("grow")!;
    m.tap(h, grow.from, grow.to);
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(0);
    // Build until a refusal or a pop appears, then check whichever came.
    for (let k = 0; k < 20 && !m.find("refuse"); k += 1) {
      const next = m.find("grow");
      if (!next) break;
      m.tap(h, next.from, next.to);
    }
    const over = m.find("refuse");
    if (over) {
      m.tap(h, over.from, over.to);
      await h.settle();
      expect(h.text()).toMatch(/goes over 10/);
      expect(h.koda.count("learning.answered")).toBe(0);
    }
    h.unmount();
  });

  it("only merges neighbours: tapping a far tile chooses it instead", async () => {
    const params = paramsFor({ mode: "bond", target: 10, size: 4 }, "far");
    const m = new Mirror(setupOf(params), "far");
    const h = renderActivity(board, { params, settings });
    fireEvent.click(m.tile(h, 0));
    fireEvent.click(m.tile(h, 15));
    expect(m.tile(h, 15).getAttribute("aria-selected")).toBe("true");
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("draws dots, rods and pies as pictures of the numbers", () => {
    const dots = renderActivity(board, { params: paramsFor({ mode: "bond", target: 5, size: 3, show: "dots" }, "d"), settings });
    expect(dots.screen.getAllByRole("gridcell")[0].querySelector('[data-picture="dots"]')).not.toBeNull();
    dots.unmount();
    const pie = renderActivity(board, { params: paramsFor({ mode: "fraction", target: 4, parts: [1, 2], size: 4 }, "f"), settings });
    expect(pie.screen.getAllByRole("gridcell")[0].querySelector('[data-picture="pie"]')).not.toBeNull();
    pie.unmount();
  });
});

describe("Number Merge switches", () => {
  it("drag_merge off leaves tapping as the only way to merge", () => {
    const on = renderActivity(board, { params: paramsFor({ mode: "bond" }, "on"), settings });
    expect(on.screen.getAllByRole("gridcell")[0].getAttribute("data-drag")).toBe("on");
    expect(on.text()).toMatch(/Drag a number/);
    on.unmount();
    const off = renderActivity(board, { params: paramsFor({ mode: "bond" }, "off"), settings, features: { drag_merge: false } });
    expect(off.screen.getAllByRole("gridcell")[0].getAttribute("data-drag")).toBe("off");
    expect(off.text()).toMatch(/^(?!.*Drag a number).*Tap a number/s);
    off.unmount();
  });

  it("sound_chimes off plays no merge sounds", async () => {
    const params = paramsFor({ mode: "bond", target: 10, size: 4, questionsPerRound: 2 }, "quiet");
    for (const enabled of [true, false]) {
      const m = new Mirror(setupOf(params), "quiet");
      const h = renderActivity(board, { params, settings, features: { sound_chimes: enabled } });
      const pop = m.find("pop")!;
      m.tap(h, pop.from, pop.to);
      await h.settle();
      expect(h.koda.count("sound.play") > 0).toBe(enabled);
      h.unmount();
    }
  });
});

describe("Number Merge practice", () => {
  it("has no hints and no read-aloud", () => {
    const lesson = skill.lessons.find((l) => l.id === "practice-make-ten")!;
    const h = renderActivity(board, { params: lesson.params as Record<string, unknown>, settings });
    expect(h.screen.queryByRole("button", { name: /hint/i })).toBeNull();
    expect(h.screen.queryByRole("button", { name: /read/i })).toBeNull();
    h.unmount();
  });
});
