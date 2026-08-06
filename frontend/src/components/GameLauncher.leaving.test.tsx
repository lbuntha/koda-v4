/**
 * Regression cover for the two ways out of an activity: Finish and Exit.
 *
 * Both used to hand control back synchronously, while the events they had just written were
 * still sitting in the outbox behind a debounce. On a phone that is a lost save — backgrounding
 * the tab cancels the request in flight — and the child came back to a lesson that did not
 * count. These tests pin that the launcher waits for the flush, says so on screen, and does not
 * run the handoff twice when a child taps again.
 */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../types";
import { GameLauncher } from "./GameLauncher";

let releaseFlush: (saved: boolean) => void;
let flushWithin: ReturnType<typeof vi.fn>;

vi.mock("../services/analyticsLogger", () => ({
  analyticsLogger: {
    logAttempt: vi.fn(),
    logHintRequested: vi.fn(),
    logSlideView: vi.fn(),
    logLessonComplete: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    flushWithin: (...args: unknown[]) => flushWithin(...args),
    getSummary: () => ({ total: 0, byType: {}, correct: 0, incorrect: 0 }),
    getEvents: () => [],
    subscribe: () => () => {},
  },
}));

vi.mock("../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playLevelUp: vi.fn(), playSuccess: vi.fn(),
    playCorrect: vi.fn(), playWrong: vi.fn(), setEnabled: vi.fn(),
    isEnabled: () => true,
  },
}));

vi.mock("./studio/canvasRegistry", () => ({
  CANVAS_BY_TECHNIQUE: {
    [CountingTechnique.ONE_TO_ONE]: ({ onSuccess }: any) => (
      <button data-testid="solve" onClick={() => onSuccess?.()} />
    ),
  },
}));

const question: CountingQuestion = {
  id: "q-1",
  technique: CountingTechnique.ONE_TO_ONE,
  title: "Activity",
  instruction: "Solve it",
  objectId: "star",
  targetCount: 3,
  config: {},
};

const mount = (handlers: { onClose?: () => void | Promise<void>; onExit?: () => void | Promise<void> }) =>
  render(
    <GameLauncher
      questions={[question]}
      activeId={question.id}
      setActiveId={() => {}}
      onClose={handlers.onClose ?? (() => {})}
      onExit={handlers.onExit}
    />,
  );

beforeEach(() => {
  flushWithin = vi.fn(() => new Promise<boolean>(resolve => { releaseFlush = resolve; }));
});
afterEach(() => vi.clearAllMocks());

describe("leaving an activity saves first", () => {
  test("finishing the last card waits for the flush before handing back", async () => {
    const onClose = vi.fn();
    mount({ onClose });

    fireEvent.click(await screen.findByTestId("solve"));
    fireEvent.click(await screen.findByText("Finish Lesson 🎊"));

    // The save is in flight: the child sees it, and the lesson has not been handed back yet.
    await screen.findByText("Saving your progress…");
    expect(flushWithin).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    releaseFlush(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("Exit waits for the flush before leaving the activity", async () => {
    const onExit = vi.fn();
    mount({ onExit });

    fireEvent.click(screen.getByText("Exit"));

    await screen.findByText("Saving before you go…");
    expect(onExit).not.toHaveBeenCalled();

    releaseFlush(true);
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
  });

  test("tapping Exit twice runs the handoff once", async () => {
    const onExit = vi.fn();
    mount({ onExit });

    const exit = screen.getByText("Exit");
    fireEvent.click(exit);
    fireEvent.click(exit);
    fireEvent.click(screen.getByText("Saving…"));

    releaseFlush(true);
    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    expect(flushWithin).toHaveBeenCalledTimes(1);
  });

  test("a save that never lands still lets the child out, and says the work is kept", async () => {
    const onExit = vi.fn();
    mount({ onExit });

    fireEvent.click(screen.getByText("Exit"));
    releaseFlush(false); // the wait ran out before the network answered

    await waitFor(() => expect(onExit).toHaveBeenCalledTimes(1));
    await screen.findByText("Still saving — this will finish next time you're online.");
  });
});
