import { describe, expect, it, vi } from "vitest";
import { act, fireEvent } from "@testing-library/react";
import { GUIDE_DEFAULTS } from "../kit";
import { expectStandardRound, renderActivity, type ActivityHarness } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, type ConnectParams } from "./activities/ConnectBoard";
import type { Board } from "./internal/types";

const connect = skill.activities.connect;
type Params = ConnectParams & Record<string, unknown>;
const lessonParams = (id: string, extra: Record<string, unknown> = {}): Params => {
  const lesson = skill.lessons.find((l) => l.id === id)!;
  const p = lesson.params as unknown as Params & { question: Record<string, unknown> };
  return { ...p, question: { ...p.question, offset: 0, ...extra } };
};

const boardEl = (h: ActivityHarness) => h.screen.getByTestId("dot-board");
const key = (h: ActivityHarness, k: string) => act(() => { fireEvent.keyDown(boardEl(h), { key: k }); });

/** The keyboard cursor, walked from `from` to `to` without drawing. */
function walk(h: ActivityHarness, size: number, from: number, to: number) {
  let r = Math.floor(from / size), c = from % size;
  const tr = Math.floor(to / size), tc = to % size;
  while (r !== tr) { key(h, r < tr ? "ArrowDown" : "ArrowUp"); r += r < tr ? 1 : -1; }
  while (c !== tc) { key(h, c < tc ? "ArrowRight" : "ArrowLeft"); c += c < tc ? 1 : -1; }
}

/** Draws `line` with the keyboard, the way a child without a pointer would. */
function draw(h: ActivityHarness, board: Board, line: number[], cursor: { at: number }) {
  walk(h, board.size, cursor.at, line[0]);
  key(h, "Enter");
  for (let i = 1; i < line.length; i += 1) {
    const d = line[i] - line[i - 1];
    key(h, d === 1 ? "ArrowRight" : d === -1 ? "ArrowLeft" : d < 0 ? "ArrowUp" : "ArrowDown");
  }
  key(h, "Enter");
  cursor.at = line[line.length - 1];
}

const solveWithKeys = (h: ActivityHarness, board: Board) => {
  const cursor = { at: board.pairs[0][0] };
  board.solution.forEach((line) => draw(h, board, line, cursor));
};

describe("the Dot Connect board", () => {
  it("runs a standard round: answers reported, XP once, three stars for a clean round", async () => {
    const params = lessonParams("fill-every-square");
    const h = await expectStandardRound(connect, async (harness) => {
      const index = harness.koda.count("learning.present");
      solveWithKeys(harness, buildQuestion(params, index).board);
    }, { params, questions: 3 });
    h.unmount();
  });

  it("scores a solved board exactly once", () => {
    const params = lessonParams("two-pairs", { questionsPerRound: 1 });
    const h = renderActivity(connect, { params });
    solveWithKeys(h, buildQuestion(params, 1).board);
    expect(h.koda.only("learning.answered")).toHaveLength(1);
    expect(h.koda.only("learning.answered")[0].args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("accepts a different valid answer, not only the stored one", () => {
    // Join-only lessons accept any lines that join the pairs.
    const params = lessonParams("one-pair", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    const [a, b] = board.pairs[0];
    // A shortest route, which leaves squares empty — fine when filling is not asked.
    const route = [a];
    let at = a;
    while (at !== b) {
      const r = Math.floor(at / 3), c = at % 3, tr = Math.floor(b / 3), tc = b % 3;
      at = r !== tr ? at + (r < tr ? 3 : -3) : at + (c < tc ? 1 : -1);
      route.push(at);
    }
    const h = renderActivity(connect, { params });
    draw(h, board, route, { at: a });
    expect(h.koda.only("learning.answered")[0]?.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("scores all pairs joined with empty squares as a wrong answer, keeps the lines, then takes the fix", async () => {
    // A board whose short routes do not cross, so joining every pair the short
    // way round is possible — and, on lesson 4's boards, always leaves gaps.
    let params = lessonParams("fill-every-square", { questionsPerRound: 1 });
    let shortest: number[][] = [];
    for (let offset = 0; offset < 96; offset += 1) {
      params = lessonParams("fill-every-square", { questionsPerRound: 1, offset });
      const b = buildQuestion(params, 1).board;
      const routes = b.pairs.map(([x, y]) => shortestRoute(b, x, y));
      const cells = routes.flatMap((r) => r ?? []);
      if (routes.every(Boolean) && new Set(cells).size === cells.length) { shortest = routes as number[][]; break; }
    }
    expect(shortest.length, "no board with non-crossing short routes").toBeGreaterThan(0);
    const board = buildQuestion(params, 1).board;
    const h = renderActivity(connect, { params });
    const cursor = { at: board.pairs[0][0] };
    for (const line of shortest) draw(h, board, line, cursor);
    const answered = h.koda.only("learning.answered");
    expect(answered.length).toBe(1);
    expect(answered[0].args[0]).toMatchObject({ correct: false });
    expect(h.text()).toMatch(/some squares are empty/i);

    // Lines are left as drawn, so the child fixes rather than redoes.
    expect(h.screen.getByTestId("dot-board").querySelectorAll("polyline").length).toBe(board.pairs.length);

    await h.press(/try again/i);
    // Redrawing on a board that is already joined is fixing, not answering.
    draw(h, board, board.solution[0], { at: cursor.at });
    expect(h.koda.only("learning.answered")).toHaveLength(1);
    const fix = { at: board.solution[0][board.solution[0].length - 1] };
    for (const line of board.solution.slice(1)) {
      draw(h, board, line, fix);
      if (h.buttons().some((b) => /try again/i.test(b))) await h.press(/try again/i);
    }
    const last = h.koda.only("learning.answered").at(-1)!;
    expect(last.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("explains a refused move without scoring it", () => {
    const params = lessonParams("two-pairs", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    const h = renderActivity(connect, { params });
    // Start on A and run straight into B's first dot.
    const [a] = board.pairs[0];
    const b = board.pairs[1][0];
    walk(h, board.size, board.pairs[0][0], a);
    key(h, "Enter");
    const path = shortestRoute({ ...board, pairs: [[a, b]] }, a, b, true)!;
    for (let i = 1; i < path.length; i += 1) {
      const d = path[i] - path[i - 1];
      key(h, d === 1 ? "ArrowRight" : d === -1 ? "ArrowLeft" : d < 0 ? "ArrowUp" : "ArrowDown");
    }
    key(h, "Enter");
    expect(h.text()).toMatch(/only end on its own letter/i);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("undo puts the last line back, and starting over is not an answer", async () => {
    const params = lessonParams("five-pairs", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    const h = renderActivity(connect, { params });
    draw(h, board, board.solution[0], { at: board.pairs[0][0] });
    const lines = () => h.screen.getByTestId("dot-board").querySelectorAll("polyline").length;
    expect(lines()).toBe(1);
    await h.press(/^undo$/i);
    expect(lines()).toBe(0);
    draw(h, board, board.solution[0], { at: board.pairs[0][0] });
    await h.press(/start over/i);
    expect(lines()).toBe(0);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("draws with a finger: pointer down on a dot, move, lift", () => {
    const params = lessonParams("one-pair", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    const h = renderActivity(connect, { params });
    const svg = h.screen.getByTestId("dot-board").querySelector("svg")!;
    const S = board.size * 100;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: S, height: S, right: S, bottom: S, x: 0, y: 0, toJSON: () => ({}) });
    const at = (cell: number) => ({ clientX: (cell % board.size) * 100 + 50, clientY: Math.floor(cell / board.size) * 100 + 50, pointerId: 1 });
    const line = board.solution[0];
    act(() => { fireEvent.pointerDown(svg, at(line[0])); });
    for (const cell of line.slice(1)) act(() => { fireEvent.pointerMove(svg, at(cell)); });
    act(() => { fireEvent.pointerUp(svg, at(line[line.length - 1])); });
    expect(h.koda.only("learning.answered")[0]?.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("checks the step count on Exact Steps", () => {
    const params = lessonParams("exact-steps", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    expect(board.steps).toBeDefined();
    const h = renderActivity(connect, { params });
    expect(h.text()).toMatch(new RegExp(`takes exactly ${board.steps!.steps} steps`));
    expect(h.screen.getByTestId("dot-board").querySelector(`[data-steps="${board.steps!.steps}"]`)).not.toBeNull();
    solveWithKeys(h, board);
    expect(h.koda.only("learning.answered")[0]?.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("plays a bridge board through to solved", () => {
    const params = lessonParams("bridges", { questionsPerRound: 1 });
    const board = buildQuestion(params, 1).board;
    const h = renderActivity(connect, { params });
    expect(h.screen.getByTestId("dot-board").querySelector("[data-bridge]")).not.toBeNull();
    solveWithKeys(h, board);
    expect(h.koda.only("learning.answered")[0]?.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });

  it("plays walls through to solved", () => {
    const params = lessonParams("walls", { questionsPerRound: 1 });
    const h = renderActivity(connect, { params });
    solveWithKeys(h, buildQuestion(params, 1).board);
    expect(h.koda.only("learning.answered")[0]?.args[0]).toMatchObject({ correct: true });
    h.unmount();
  });
});

describe("Dot Connect help and practice", () => {
  it("offers a three-rung hint on teaching lessons", () => {
    const h = renderActivity(connect, { params: lessonParams("one-way-out") });
    expect(h.buttons().some((b) => /hint/i.test(b))).toBe(true);
    h.unmount();
  });

  it("practice has no hints, no guide and opens silently", () => {
    const h = renderActivity(connect, { params: lessonParams("practice-planning") });
    expect(h.buttons().some((b) => /hint/i.test(b))).toBe(false);
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });

  it("On Your Own is a teaching lesson with the hints taken away", () => {
    const h = renderActivity(connect, { params: lessonParams("on-your-own") });
    expect(h.buttons().some((b) => /hint/i.test(b))).toBe(false);
    h.unmount();
  });

  it("a practice round cycles its specs", () => {
    const params = lessonParams("practice-dot-connect");
    const ids = [1, 2, 3, 4, 5].map((i) => buildQuestion(params, i).id.replace(/-\d+$/, ""));
    expect(new Set(ids).size).toBe(5);
  });

  it("practice stays silent across a whole round", async () => {
    const params = lessonParams("practice-joining", { questionsPerRound: 2 });
    const h = renderActivity(connect, { params, settings: { praiseMs: 0 } });
    for (let i = 1; i <= 2; i += 1) {
      solveWithKeys(h, buildQuestion(params, i).board);
      await h.settle(10);
    }
    expect(h.results).toHaveLength(1);
    expect(h.koda.only("speech.say").filter((c) => !/correct|joined|solved|plan|board|nicely/i.test(String(c.args[0])))).toEqual([]);
    h.unmount();
  });
});

describe("Dot Connect switches", () => {
  const solvedTwoPairs = (features: Record<string, boolean>) => {
    const params = lessonParams("two-pairs", { questionsPerRound: 1 });
    const h = renderActivity(connect, { params, features });
    solveWithKeys(h, buildQuestion(params, 1).board);
    return h;
  };

  it("move_hints off removes the Hint button", () => {
    const h = renderActivity(connect, { params: lessonParams("one-way-out"), features: { move_hints: false } });
    expect(h.buttons().some((b) => /hint/i.test(b))).toBe(false);
    h.unmount();
  });

  it("sound_chimes off plays no sounds; on plays the join and solved sounds", () => {
    const quiet = solvedTwoPairs({ sound_chimes: false });
    expect(quiet.koda.count("sound.play")).toBe(0);
    quiet.unmount();
    const loud = solvedTwoPairs({});
    expect(loud.koda.only("sound.play").map((c) => c.args[0])).toEqual(expect.arrayContaining(["pop", "success"]));
    loud.unmount();
  });

  it("haptic_feedback off stops vibration", () => {
    const off = solvedTwoPairs({ haptic_feedback: false });
    expect(off.koda.count("haptics.tap") + off.koda.count("haptics.success")).toBe(0);
    off.unmount();
    const on = solvedTwoPairs({});
    expect(on.koda.count("haptics.success")).toBeGreaterThan(0);
    on.unmount();
  });

  it("audio_speech off removes the read-aloud button", () => {
    const on = renderActivity(connect, { params: lessonParams("one-pair") });
    const off = renderActivity(connect, { params: lessonParams("one-pair"), features: { audio_speech: false } });
    const reads = (h: ActivityHarness) => h.buttons().some((b) => /read|listen|hear|speak/i.test(b));
    expect(reads(on)).toBe(true);
    on.unmount();
    expect(reads(off)).toBe(false);
    off.unmount();
  });

  it("guide_coach off keeps the Smart guide from stepping in", () => {
    vi.useFakeTimers();
    try {
      const params = lessonParams("one-way-out");
      const on = renderActivity(connect, { params });
      act(() => { vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + 100); });
      expect(on.text()).toContain("Koda is helping");
      on.unmount();
      const off = renderActivity(connect, { params, features: { guide_coach: false } });
      act(() => { vi.advanceTimersByTime(GUIDE_DEFAULTS.startMs + 100); });
      expect(off.text()).not.toContain("Koda is helping");
      off.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Shortest route between two cells avoiding walls and other dots (and, unless told, bridges). */
function shortestRoute(board: Board, from: number, to: number, ignoreDots = false): number[] | null {
  const size = board.size;
  const blocked = new Set<number>([...board.walls, ...(board.bridges ?? [])]);
  if (!ignoreDots) board.pairs.flat().forEach((d) => { if (d !== from && d !== to) blocked.add(d); });
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    const r = Math.floor(cur / size), c = cur % size;
    for (const nb of [r > 0 ? cur - size : -1, r < size - 1 ? cur + size : -1, c > 0 ? cur - 1 : -1, c < size - 1 ? cur + 1 : -1]) {
      if (nb < 0 || blocked.has(nb) || prev.has(nb)) continue;
      prev.set(nb, cur);
      queue.push(nb);
    }
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}
