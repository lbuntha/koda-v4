import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { ColumnSubtractionCanvas } from "./ColumnSubtractionCanvas";

vi.mock("../../sound", () => ({
  sounds: {
    playFailure: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playTick: vi.fn(),
  },
}));

afterEach(() => vi.clearAllMocks());

const question = (
  technique: CountingTechnique.SUBTRACTION_COLUMN | CountingTechnique.SUBTRACTION_COLUMN_MULTI,
): CountingQuestion => ({
  id: `q-${technique}`,
  technique,
  title: "Column Subtraction",
  instruction: "Subtract by place value",
  objectId: "star",
  targetCount: 321,
  config: technique === CountingTechnique.SUBTRACTION_COLUMN
    ? { minuend: 575, subtrahend: 254 }
    : { minuend: 900, subtrahend: 123, subtrahend2: 456 },
});

describe("Column Subtraction canvas", () => {
  test.each([
    ["standard", CountingTechnique.SUBTRACTION_COLUMN],
    ["multi-row", CountingTechnique.SUBTRACTION_COLUMN_MULTI],
  ] as const)("uses the virtual keypad from right to left in %s mode", (_, technique) => {
    const { getByRole, queryAllByRole } = render(
      <ColumnSubtractionCanvas question={question(technique)} isPlayMode />,
    );

    expect(queryAllByRole("textbox")).toHaveLength(0);

    fireEvent.click(getByRole("button", { name: "Enter 1" }));
    expect(getByRole("button", { name: "Answer for ones: 1" })).toBeTruthy();

    fireEvent.click(getByRole("button", { name: "Enter 2" }));
    expect(getByRole("button", { name: "Answer for tens: 2" })).toBeTruthy();

    fireEvent.click(getByRole("button", { name: "Enter 3" }));
    expect(getByRole("button", { name: "Answer for hundreds: 3" })).toBeTruthy();
  });
});
