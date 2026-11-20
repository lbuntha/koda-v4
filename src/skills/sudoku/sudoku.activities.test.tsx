import { fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildGameQuestion, type GameQuestion, type SudokuParams } from "./activities/Sudoku";
import { buildSpotQuestion, type SpotParams } from "./activities/Spot";
import { pictureName } from "./activities/Board";
import { cellName } from "./activities/words";

const game = skill.activities.game;
const spot = skill.activities.spot;
const settings = { praiseMs: 0 };

type Params = SudokuParams & SpotParams & Record<string, unknown>;

const lessonParams = (id: string, seed: string): Params => {
  const lesson = skill.lessons.find((l) => l.id === id)!;
  const params = lesson.params as SudokuParams;
  return { ...params, question: { ...params.question, seed } } as Params;
};

type H = ReturnType<typeof renderActivity>;
const cell = (h: H, n: number, i: number) => h.screen.getByRole("gridcell", { name: new RegExp(`^${cellName(n, i)},`) });
const nameOf = (q: GameQuestion, d: number) => (q.pictures ? pictureName(q.pictures, d) : String(d));

/** Fill cells the way a child does: tap the cell, then the number. */
function fill(h: H, q: GameQuestion, values: Map<number, number>) {
  for (const [i, d] of values) {
    fireEvent.click(cell(h, q.puzzle.n, i));
    fireEvent.click(h.screen.getByRole("button", { name: `Put ${nameOf(q, d)}` }));
  }
}
const blanksOf = (q: GameQuestion) => q.puzzle.givens.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
const answers = (q: GameQuestion) => new Map(blanksOf(q).map((i) => [i, q.puzzle.answer[i]]));

describe("a whole puzzle", () => {
  it("checks itself when the last cell is filled — there is no Check button", async () => {
    const params = lessonParams("first-picture-sudoku", "t1");
    const q = buildGameQuestion(params, 1, "x");
    expect(q.pictures).toBeDefined();
    const h = renderActivity(game, { params, settings });
    expect(h.screen.queryByRole("button", { name: /^check$/i })).toBeNull();
    fill(h, q, answers(q));
    await h.settle();
    const answered = h.koda.only("learning.answered");
    expect(answered).toHaveLength(1);
    expect(JSON.stringify(answered[0].args)).toContain(q.expected!);
    h.unmount();
  });

  it("finishes a whole round of picture puzzles", async () => {
    const base = lessonParams("first-picture-sudoku", "round");
    const params: Params = { ...base, question: { ...base.question, questionsPerRound: 3 } };
    const h = renderActivity(game, { params, settings });
    for (let i = 1; i <= 3; i += 1) {
      fill(h, buildGameQuestion(params, i, "x"), answers(buildGameQuestion(params, i, "x")));
      await h.settle();
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("learning.answered")).toBe(3);
    h.unmount();
  });

  it("marks wrong cells when the grid is full, and takes a correction", async () => {
    const params = lessonParams("number-sudoku-4", "wrong");
    const q = buildGameQuestion(params, 1, "x");
    const blanks = blanksOf(q);
    const h = renderActivity(game, { params, settings });
    const wrongFill = answers(q);
    const first = blanks[0];
    wrongFill.set(first, (q.puzzle.answer[first] % 4) + 1);
    fill(h, q, wrongFill);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.text()).toMatch(/not right/);
    expect(cell(h, 4, first).textContent).toContain("✗");

    await h.press("Try again");
    fireEvent.click(cell(h, 4, first));
    expect(cell(h, 4, first).getAttribute("aria-label")).toMatch(/empty$/);
    fill(h, q, new Map([[first, q.puzzle.answer[first]]]));
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(2);
    h.unmount();
  });

  it("keeps notes in a lesson that has them, and Fill notes writes every candidate", () => {
    const params = lessonParams("pointing-puzzle", "notes");
    const q = buildGameQuestion(params, 1, "x");
    const h = renderActivity(game, { params, settings });
    const i = blanksOf(q)[0];
    fireEvent.click(cell(h, 9, i));
    fireEvent.click(h.screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(h.screen.getByRole("button", { name: "Note 1" }));
    expect(cell(h, 9, i).getAttribute("aria-label")).toMatch(/notes 1$/);
    fireEvent.click(h.screen.getByRole("button", { name: "Fill notes" }));
    expect(h.screen.getAllByRole("gridcell").filter((c) => /notes/.test(c.getAttribute("aria-label") ?? "")).length).toBe(blanksOf(q).length);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("hints name the technique and end with a move", async () => {
    const params = lessonParams("scan-6x6", "hint");
    const h = renderActivity(game, { params, settings });
    await h.press(/hint/i);
    // Past the lesson's own tip: the easiest move on this board, explained.
    await h.press("More help");
    expect(h.text()).toMatch(/(row|column|box) \d/);
    h.unmount();
  });
});

describe("spot it", () => {
  it("places a named number on the first tap and times the find", async () => {
    const params = lessonParams("spot-scan-9", "spot");
    const q = buildSpotQuestion(params, 1, "x");
    expect(q.drill.digit).toBeDefined();
    const h = renderActivity(spot, { params, settings });
    const target = q.drill.finds[0];
    fireEvent.click(cell(h, 9, target.cell));
    await h.settle();
    const answered = h.koda.only("learning.answered");
    expect(answered).toHaveLength(1);
    expect(JSON.stringify(answered[0].args)).toContain('"correct":true');
    h.unmount();
  });

  it("says a wrong cell is not certain, and keeps the question", async () => {
    const params = lessonParams("spot-scan-9", "spotwrong");
    const q = buildSpotQuestion(params, 1, "x");
    const h = renderActivity(spot, { params, settings });
    const wrong = q.drill.grid.findIndex((v, i) => !v && !q.drill.finds.some((m) => m.cell === i));
    fireEvent.click(cell(h, 9, wrong));
    expect(h.text()).toMatch(/Not that one/);
    await h.press("Try again");
    fireEvent.click(cell(h, 9, q.drill.finds[0].cell));
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(2);
    h.unmount();
  });

  it("asks for the cell, then the number, when no number is named", async () => {
    const params = lessonParams("spot-naked-single", "naked");
    const q = buildSpotQuestion(params, 1, "x");
    expect(q.drill.digit).toBeUndefined();
    const h = renderActivity(spot, { params, settings });
    const target = q.drill.finds[0];
    fireEvent.click(cell(h, 9, target.cell));
    fireEvent.click(h.screen.getByRole("button", { name: `Put ${target.value}` }));
    await h.settle();
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("shows notes from Pointing on", () => {
    const params = lessonParams("spot-x-wing", "xw");
    const h = renderActivity(spot, { params, settings });
    expect(h.screen.getAllByRole("gridcell").some((c) => /notes/.test(c.getAttribute("aria-label") ?? ""))).toBe(true);
    h.unmount();
  });
});

describe("practice", () => {
  it("runs a timed mix without hints or speech", async () => {
    const params = lessonParams("practice-rows-and-columns", "prac");
    const h = renderActivity(spot, { params, settings });
    expect(h.screen.queryByRole("button", { name: /hint/i })).toBeNull();
    const total = params.question?.questionsPerRound ?? 8;
    for (let i = 1; i <= total; i += 1) {
      const q = buildSpotQuestion(params, i, "x");
      fireEvent.click(cell(h, 9, q.drill.finds[0].cell));
      if (!q.drill.digit) fireEvent.click(h.screen.getByRole("button", { name: `Put ${q.drill.finds[0].value}` }));
      await h.settle();
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("speech.say"), "a practice round spoke").toBe(0);
    h.unmount();
  });
});

describe("feature switches", () => {
  const params = lessonParams("first-picture-sudoku", "feat");
  const q = buildGameQuestion(params, 1, "x");
  const play = async (features: Record<string, boolean>) => {
    const h = renderActivity(game, { params, settings, features });
    fill(h, q, answers(q));
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

  it("haptic_feedback off: no vibration when solved", async () => {
    const on = await play({});
    expect(on.koda.count("haptics.success")).toBeGreaterThan(0);
    on.unmount();
    const off = await play({ haptic_feedback: false });
    expect(off.koda.count("haptics.success")).toBe(0);
    off.unmount();
  });

  it("audio_speech off: no prompt read aloud", () => {
    const on = renderActivity(game, { params, settings });
    expect(on.koda.count("speech.say")).toBeGreaterThan(0);
    on.unmount();
    const off = renderActivity(game, { params, settings, features: { audio_speech: false } });
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });
});
