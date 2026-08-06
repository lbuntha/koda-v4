import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { ColumnAdditionCanvas } from "./ColumnAdditionCanvas";

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
  technique: CountingTechnique.ADDITION_COLUMN | CountingTechnique.ADDITION_COLUMN_MULTI,
): CountingQuestion => ({
  id: `q-${technique}`,
  technique,
  title: "Column Addition",
  instruction: "Add by place value",
  objectId: "star",
  targetCount: 31,
  config: technique === CountingTechnique.ADDITION_COLUMN
    ? { num1: 18, num2: 13 }
    : { num1: 10, num2: 10, num3: 11 },
});

describe("Column Addition canvas", () => {
  test.each([
    ["standard", CountingTechnique.ADDITION_COLUMN],
    ["multi-row", CountingTechnique.ADDITION_COLUMN_MULTI],
  ] as const)("uses only the virtual keypad and advances from ones to tens in %s mode", (_, technique) => {
    const { getByRole, queryAllByRole } = render(
      <ColumnAdditionCanvas question={question(technique)} isPlayMode />,
    );

    expect(queryAllByRole("textbox")).toHaveLength(0);

    fireEvent.click(getByRole("button", { name: "Enter 1" }));
    expect(getByRole("button", { name: "Answer digit for the ones: 1" })).toBeTruthy();

    fireEvent.click(getByRole("button", { name: "Enter 3" }));
    expect(getByRole("button", { name: "Answer digit for the tens: 3" })).toBeTruthy();
  });
});
