import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { XtraMathCanvas } from "./XtraMathCanvas";

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playWin: vi.fn(),
    playFailure: vi.fn(),
    playSparkle: vi.fn(),
  },
}));

afterEach(() => vi.clearAllMocks());

const question = (overrides?: Partial<CountingQuestion>): CountingQuestion => ({
  id: "q-xtramath",
  technique: CountingTechnique.XTRA_MATH,
  title: "XtraMath",
  instruction: "Choose the answer",
  objectId: "star",
  targetCount: 1,
  config: { levelId: "xm_level_1", themeId: "forest", timeLimitSec: 12 },
  ...overrides,
});

describe("XtraMath canvas", () => {
  test("honors the explicit dark mode and authored timer", () => {
    const { getAllByRole, getByLabelText } = render(
      <XtraMathCanvas question={question()} isPlayMode isDark />,
    );

    const answer = getAllByRole("button", { name: /^Answer / })[0];
    expect(answer.className).toContain("bg-white/10");
    expect(answer.className).toContain("text-white");
    const timer = getByLabelText("12 seconds remaining for this fact") as HTMLProgressElement;
    expect(timer.max).toBe(12);
    expect(timer.value).toBe(12);
    expect(getByLabelText("Emerald Glass Meadow math fluency practice")).toBeTruthy();
  });

  test("keeps every answer readable on the standard light surface", () => {
    const { getAllByRole } = render(<XtraMathCanvas question={question()} isPlayMode />);

    for (const answer of getAllByRole("button", { name: /^Answer / })) {
      expect(answer.className).toContain("bg-white");
      expect(answer.className).toContain("text-slate-950");
      expect(answer.textContent?.trim()).not.toBe("");
    }
  });

  test("uses localized, non-color-only feedback for a wrong answer", () => {
    const { getAllByRole, getByLabelText } = render(
      <XtraMathCanvas question={question({ targetCount: 2 })} isPlayMode />,
    );
    const equation = getByLabelText(/equals unknown/).getAttribute("aria-label")!;
    const [, first, operator, second] = equation.match(/(\d+) ([+\-×÷]) (\d+)/)!;
    const left = Number(first);
    const right = Number(second);
    const correct = operator === "+"
      ? left + right
      : operator === "-"
        ? left - right
        : operator === "×"
          ? left * right
          : left / right;
    const wrongAnswer = getAllByRole("button", { name: /^Answer / })
      .find((button) => button.getAttribute("aria-label") !== `Answer ${correct}`)!;

    fireEvent.click(wrongAnswer);

    expect(wrongAnswer.className).toContain("animate-shake");
    expect(wrongAnswer.className).toContain("bg-rose-600");
    expect(wrongAnswer.querySelector("svg")).toBeTruthy();
  });

  test("provides concrete models for all four operations", () => {
    const cases: Array<[string, RegExp, boolean]> = [
      ["xm_level_1", /dots and .* more dots make/, false],
      ["xm_level_4", /dots with .* crossed out leaves/, true],
      ["xm_level_6", /groups with .* dots in each group make/, true],
      ["xm_level_8", /dots split into .* equal groups/, true],
    ];

    for (const [levelId, modelLabel, needsHint] of cases) {
      const view = render(
        <XtraMathCanvas
          question={question({ id: `q-${levelId}`, config: { levelId, timeLimitSec: 6 } })}
          isPlayMode
        />,
      );
      if (needsHint) fireEvent.click(view.getByRole("button", { name: "Show hint" }));
      expect(view.getByRole("img", { name: modelLabel })).toBeTruthy();
      view.unmount();
    }
  });

  test("reports completion once with the selected answer", () => {
    const onSuccess = vi.fn();
    const onAttempt = vi.fn();
    const { getAllByRole } = render(
      <XtraMathCanvas
        question={question()}
        isPlayMode
        onSuccess={onSuccess}
        onAttempt={onAttempt}
      />,
    );

    const answerButtons = getAllByRole("button", { name: /^Answer / });
    for (const button of answerButtons) {
      if (!onSuccess.mock.calls.length) fireEvent.click(button);
    }

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const correctAttempts = onAttempt.mock.calls.filter(([outcome]) => outcome === "correct");
    expect(correctAttempts).toHaveLength(1);
    expect(correctAttempts[0][1].selected).toBe(correctAttempts[0][1].expected);
    const selectedAnswer = answerButtons.find((button) => button.getAttribute("aria-pressed") === "true")!;
    expect(selectedAnswer.className).toContain("animate-scale-in");
    expect(selectedAnswer.querySelector("svg")).toBeTruthy();

    for (const button of answerButtons) fireEvent.click(button);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("exposes the hint control with a clear accessible name", () => {
    const onHint = vi.fn();
    const { getByRole, getAllByText } = render(
      <XtraMathCanvas question={question()} isPlayMode onHint={onHint} />,
    );

    fireEvent.click(getByRole("button", { name: "Show hint" }));
    expect(onHint).toHaveBeenCalledTimes(1);
    expect(getAllByText(/Count on from/).length).toBeGreaterThan(0);
    expect(getByRole("button", { name: "Hide hint" })).toBeTruthy();
  });
});
