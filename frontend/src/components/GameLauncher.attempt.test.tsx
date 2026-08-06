/**
 * Regression cover for how a solved activity reports its answer.
 *
 * A canvas signals a solve with `onSuccess()`, and a canvas that knows the solved
 * state also calls `onAttempt("correct", { selected })` — in that order, in the same
 * tick (see LiquidSortCanvas). GameLauncher bridges `onSuccess` into a "correct"
 * attempt for the canvases that report nothing else, and a first-writer guard keeps
 * the two from double-logging.
 *
 * Get the order wrong and the bridge wins: the attempt is logged with no selection,
 * server-side grading fails ("selection must be a list of bottles"), the event is
 * stored unverified, and the learner is told the activity could not be saved — after
 * solving it. These tests pin the contract for every canvas, present and future.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../types";
import { GameLauncher } from "./GameLauncher";

const logAttempt = vi.fn();

vi.mock("../services/analyticsLogger", () => ({
  analyticsLogger: {
    logAttempt: (...args: unknown[]) => logAttempt(...args),
    logHintRequested: vi.fn(),
    logSlideView: vi.fn(),
    logLessonComplete: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    getSummary: () => ({ total: 0, byType: {}, correct: 0, incorrect: 0 }),
    getEvents: () => [],
    subscribe: () => () => {},
  },
}));

vi.mock("../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playLevelUp: vi.fn(),
    playCorrect: vi.fn(), playWrong: vi.fn(), setEnabled: vi.fn(),
    isEnabled: () => true,
  },
}));

/** Stands in for a canvas that reports its own solved state, like Liquid Sort. */
const SOLVED_BOARD = [["cyan", "cyan", "cyan"], ["magenta", "magenta", "magenta"], []];

// The stubs solve on click rather than while mounting: a real learner always solves
// after the launcher has mounted, and mount-time solving would race the per-question
// guard reset (child effects run before parent effects) rather than test the ordering.
vi.mock("./studio/canvasRegistry", () => ({
  CANVAS_BY_TECHNIQUE: {
    // Reports the board it ended with — the detail the server needs to grade.
    [CountingTechnique.LIQUID_SORT]: ({ onSuccess, onAttempt }: any) => (
      <button
        data-testid="solve"
        onClick={() => {
          onSuccess?.();
          onAttempt?.("correct", { selected: SOLVED_BOARD, details: { levelId: "level_1" } });
        }}
      />
    ),
    // Signals only that it was solved, like most canvases.
    [CountingTechnique.ONE_TO_ONE]: ({ onSuccess }: any) => (
      <button data-testid="solve" onClick={() => onSuccess?.()} />
    ),
  },
}));

const question = (technique: CountingTechnique, config: Record<string, any> = {}): CountingQuestion => ({
  id: `q-${technique}`,
  technique,
  title: "Activity",
  instruction: "Solve it",
  objectId: "star",
  targetCount: 3,
  config,
});

/** Mount the launcher on one activity, then solve it the way a learner would. */
const solveActivity = async (q: CountingQuestion) => {
  render(
    <GameLauncher questions={[q]} activeId={q.id} setActiveId={() => {}} onClose={() => {}} />,
  );
  fireEvent.click(await screen.findByTestId("solve"));
};

const correctAttempts = () => logAttempt.mock.calls.filter(call => call[1] === "correct");

beforeEach(() => logAttempt.mockClear());
afterEach(() => vi.clearAllMocks());

describe("solved-activity reporting", () => {
  test("a canvas that reports its own board wins over the onSuccess bridge", async () => {
    await solveActivity(question(CountingTechnique.LIQUID_SORT));

    await waitFor(() => expect(correctAttempts()).toHaveLength(1));
    const [, , detail] = correctAttempts()[0];
    // The whole point: the graded payload is the board, never an empty bridge report.
    expect(detail?.selected).toEqual(SOLVED_BOARD);
  });

  test("the bridge still reports for a canvas that only signals success", async () => {
    await solveActivity(question(CountingTechnique.ONE_TO_ONE));

    await waitFor(() => expect(correctAttempts()).toHaveLength(1));
    const [, , detail] = correctAttempts()[0];
    // ONE_TO_ONE has a derivable answer, so the bridge supplies the target count.
    expect(detail?.selected).toBe("3");
  });

  test("a solve is never logged as two correct attempts", async () => {
    await solveActivity(question(CountingTechnique.LIQUID_SORT));

    await waitFor(() => expect(correctAttempts()).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(correctAttempts()).toHaveLength(1);
  });

  test("curriculum difficulty is logged separately from canvas presentation modes", async () => {
    const authored = question(CountingTechnique.ONE_TO_ONE);
    authored.difficulty = "hard";
    await solveActivity(authored);

    await waitFor(() => expect(correctAttempts()).toHaveLength(1));
    const [context] = correctAttempts()[0];
    expect(context.difficulty).toBe("hard");
  });
});
