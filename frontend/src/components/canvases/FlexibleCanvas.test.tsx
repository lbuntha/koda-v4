/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Flexible Canvas — that a child can actually answer it.
 *
 * The bug this file starts from was invisible in every way a screenshot can
 * show: the answer buttons rendered, in the right place, in the right state,
 * and did nothing when pressed. The stage above them is `flex-1` with a pixel
 * `min-h` and a `z-10`, so on a short card it grew over the row and — being
 * positioned where the row was not — painted on top of it and took the clicks.
 *
 * jsdom cannot see a stacking bug, so these do not pretend to. What they pin is
 * the half a test can hold: that pressing a choice reaches the canvas, that the
 * right answer is judged right, and that a wrong one is reported rather than
 * silently swallowed. A regression in the wiring fails here; a regression in
 * the layering needs eyes on it.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { FlexibleCanvas } from "./FlexibleCanvas";
import { CountingQuestion, CountingTechnique } from "../../types";

// Artwork and audio are not what is under test, and both reach for context and
// browser APIs jsdom does not have. Same stubs the Count canvas tests use.
vi.mock("../Assets", () => ({
  CountingAsset: ({ size }: { size: number }) => <span data-testid="asset" style={{ width: size }} />,
}));

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playFailure: vi.fn(), playSparkle: vi.fn(),
    playSuccess: vi.fn(), playLevelUp: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
    playTick: vi.fn(), playSlide: vi.fn(), setEnabled: vi.fn(), isEnabled: () => true,
  },
}));

beforeEach(() => {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/** Five objects, four choices, and the truth is the object count. */
const question = (config: Record<string, unknown> = {}): CountingQuestion =>
  ({
    id: "q-flex",
    title: "How many?",
    instruction: "How many bottle bobas?",
    technique: CountingTechnique.FLEXIBLE_CANVAS,
    objectId: "apple",
    targetCount: 5,
    config: {
      flexibleMode: "multichoice",
      flexibleItems: Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        emoji: "🧋",
        x: 20 + i * 60,
        y: 40,
      })),
      flexibleChoices: ["3", "4", "5", "6"],
      ...config,
    },
  }) as unknown as CountingQuestion;

describe("Flexible Canvas · answering", () => {
  it("reports the right answer as correct", () => {
    const onAttempt = vi.fn();
    const onSuccess = vi.fn();
    render(
      <FlexibleCanvas
        question={question()}
        isPlayMode
        showGrid={false}
        onAttempt={onAttempt}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "5" }));

    expect(onAttempt).toHaveBeenCalledWith("correct", expect.anything());
    expect(onSuccess).toHaveBeenCalled();
  });

  it("reports a wrong answer rather than ignoring it", () => {
    // The failure mode was a press that produced nothing at all — no attempt
    // logged, no feedback, no sound. "Nothing happened" is the bug.
    const onAttempt = vi.fn();
    render(<FlexibleCanvas question={question()} isPlayMode showGrid={false} onAttempt={onAttempt} />);

    fireEvent.click(screen.getByRole("button", { name: "3" }));

    expect(onAttempt).toHaveBeenCalledWith("incorrect", expect.anything());
  });

  it("offers every choice the slide was authored with", () => {
    render(<FlexibleCanvas question={question()} isPlayMode showGrid={false} />);
    for (const choice of ["3", "4", "5", "6"]) {
      expect(screen.getByRole("button", { name: choice })).not.toBeNull();
    }
  });
});
