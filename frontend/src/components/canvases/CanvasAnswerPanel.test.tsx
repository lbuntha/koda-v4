/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The contract nine more canvases are about to be migrated onto. These lock the
 * behaviour that was previously duplicated (and quietly drifting) in each one.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";

vi.mock("../../sound", () => ({
  sounds: {
    playSuccess: vi.fn(),
    playFailure: vi.fn(),
    playPop: vi.fn(),
    playTick: vi.fn()
  }
}));

import { sounds } from "../../sound";

/** Minimal host: the panel is always driven by the hook, so test them together. */
const Host: React.FC<{
  expected: number;
  onSuccess?: () => void;
  open?: boolean;
  resetKey?: string;
  numberPadDefault?: boolean;
}> = ({ expected, onSuccess, open = true, resetKey = "q1", numberPadDefault }) => {
  const answer = useCanvasAnswer({
    expected,
    resetKey,
    wrongMessage: `Not quite! Enter ${expected}!`,
    onSuccess,
    open,
    numberPadDefault
  });
  return <CanvasAnswerPanel answer={answer} open={open} prompt="How many in total?" />;
};

const input = () => screen.getByLabelText("Your answer") as HTMLInputElement;
const togglePad = () => fireEvent.click(screen.getByTitle("Toggle Number Pad"));
const padToggle = () => screen.getByTitle("Toggle Number Pad");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCanvasAnswer + CanvasAnswerPanel", () => {
  it("accepts a correct answer and hands off to onSuccess after the sound", () => {
    const onSuccess = vi.fn();
    render(<Host expected={12} onSuccess={onSuccess} />);

    fireEvent.change(input(), { target: { value: "12" } });
    fireEvent.click(screen.getByText("Check"));

    expect(sounds.playSuccess).toHaveBeenCalledTimes(1);
    // Deliberately delayed — the child should hear the success before moving on.
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong answer with the canvas's own message and does not advance", () => {
    const onSuccess = vi.fn();
    render(<Host expected={12} onSuccess={onSuccess} />);

    fireEvent.change(input(), { target: { value: "11" } });
    fireEvent.click(screen.getByText("Check"));

    expect(screen.getByRole("alert").textContent).toContain("Not quite! Enter 12!");
    expect(sounds.playFailure).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("treats an empty or non-numeric entry as 'enter a number', not as wrong", () => {
    render(<Host expected={12} />);

    fireEvent.change(input(), { target: { value: "abc" } });
    fireEvent.click(screen.getByText("Check"));

    expect(screen.getByRole("alert").textContent).toContain("Please enter a number!");
  });

  it("clears the error as soon as the child types again", () => {
    render(<Host expected={12} />);

    fireEvent.change(input(), { target: { value: "11" } });
    fireEvent.click(screen.getByText("Check"));
    expect(screen.queryByRole("alert")).toBeTruthy();

    fireEvent.change(input(), { target: { value: "1" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("freezes once correct, so a child cannot type past the pending hand-off", () => {
    render(<Host expected={5} />);

    fireEvent.change(input(), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Check"));
    expect(input().value).toBe("5");
    expect(input().disabled).toBe(true);

    // The pad is hidden when correct, so drive the hook through the input.
    fireEvent.change(input(), { target: { value: "59" } });
    expect(input().value).toBe("5");
  });

  it("caps entry at three digits", () => {
    render(<Host expected={999} />);

    for (const digit of ["1", "2", "3", "4"]) {
      fireEvent.click(screen.getByLabelText(`Enter ${digit}`));
    }
    expect(input().value).toBe("123");
  });

  it("backspace and clear work from the pad", () => {
    render(<Host expected={999} />);

    fireEvent.click(screen.getByLabelText("Enter 4"));
    fireEvent.click(screen.getByLabelText("Enter 2"));
    expect(input().value).toBe("42");

    fireEvent.click(screen.getByText("Backspace"));
    expect(input().value).toBe("4");

    fireEvent.click(screen.getByText("Clear"));
    expect(input().value).toBe("");
  });

  it("submits on Enter", () => {
    const onSuccess = vi.fn();
    render(<Host expected={7} onSuccess={onSuccess} />);

    fireEvent.change(input(), { target: { value: "7" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("resets everything when the question changes", () => {
    const { rerender } = render(<Host expected={5} resetKey="q1" />);

    fireEvent.change(input(), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Check"));
    expect(input().disabled).toBe(true);

    rerender(<Host expected={8} resetKey="q2" />);

    // A stale "correct" would otherwise skip the child straight past the next slide.
    expect(input().value).toBe("");
    expect(input().disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not fire a pending success after the question has moved on", () => {
    const onSuccess = vi.fn();
    const { rerender } = render(<Host expected={5} onSuccess={onSuccess} resetKey="q1" />);

    fireEvent.change(input(), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Check"));

    rerender(<Host expected={8} onSuccess={onSuccess} resetKey="q2" />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("renders nothing while closed", () => {
    render(<Host expected={5} open={false} />);
    expect(screen.queryByLabelText("Your answer")).toBeNull();
  });

  /*
    The pad is the way in on a tablet, not an accessory: a child who has to find
    a calculator button first is a child typing on the OS keyboard instead.
  */
  it("shows the number pad without being asked", () => {
    render(<Host expected={5} />);

    expect(screen.getByLabelText("Enter 7")).toBeTruthy();
    expect(padToggle().getAttribute("aria-pressed")).toBe("true");
    // And the OS keyboard is kept out of the way of the keys it duplicates.
    expect(input().getAttribute("inputmode")).toBe("none");
  });

  it("hides the pad on request, and hands the OS keyboard back", () => {
    render(<Host expected={5} />);
    togglePad();

    expect(padToggle().getAttribute("aria-pressed")).toBe("false");
    expect(input().getAttribute("inputmode")).toBe("numeric");
  });

  it("a canvas with no room for the pad can start without it", () => {
    render(<Host expected={5} numberPadDefault={false} />);

    expect(padToggle().getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByLabelText("Enter 7")).toBeNull();
  });

  it("restores the pad to its default on the next question", () => {
    const { rerender } = render(<Host expected={5} resetKey="q1" />);
    togglePad();
    expect(padToggle().getAttribute("aria-pressed")).toBe("false");

    rerender(<Host expected={8} resetKey="q2" />);
    expect(padToggle().getAttribute("aria-pressed")).toBe("true");
  });
});
