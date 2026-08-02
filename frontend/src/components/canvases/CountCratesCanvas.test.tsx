/**
 * Renders the real Counting Crates board and fills an order.
 *
 * `countCratesModel.test.ts` proves the rules and the ladder; it never mounts anything, so
 * it cannot catch what actually reaches a child — a crate that does not respond to a tap,
 * a running total that does not move, a keyboard that does nothing, or a solve that
 * reports a claim of success instead of the tray the server has to re-add.
 *
 * That last one is why this file exists at all: it is the failure that shipped twice in
 * the sorting games, and unit tests were green both times.
 */

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { CountCratesCanvas } from "./CountCratesCanvas";
import {
  COUNT_CRATES_LEVELS,
  solveCountCrates,
  startingBoard,
  type CratesLevel,
} from "./countCratesModel";

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playFailure: vi.fn(), playSparkle: vi.fn(),
    playSuccess: vi.fn(), playLevelUp: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
    setEnabled: vi.fn(), isEnabled: () => true,
  },
}));

afterEach(() => vi.clearAllMocks());

const question = (levelId: string): CountingQuestion => ({
  id: `q-${levelId}`,
  technique: CountingTechnique.COUNT_CRATES,
  title: "Counting Crates",
  instruction: "Fill the order",
  objectId: "star",
  targetCount: 10,
  config: { levelId },
});

const level = (id: string) => COUNT_CRATES_LEVELS.find((item) => item.id === id)!;

/** Tap the crate of a given size on the shelf. */
const tapCrate = (container: HTMLElement, unit: number) => {
  const button = [...container.querySelectorAll("button")].find((element) =>
    element.getAttribute("aria-label")?.startsWith(`Load ${unit} `)
    || element.getAttribute("aria-label")?.startsWith(`Load ${unit} `),
  );
  expect(button, `no crate of ${unit} on the shelf`).toBeTruthy();
  fireEvent.click(button!);
};

const trayTotalText = (container: HTMLElement) =>
  container.querySelector("[data-testid='tray-total']")!.textContent;

const fill = (container: HTMLElement, target: CratesLevel) => {
  for (const unit of solveCountCrates(startingBoard(target), target)!.crates) {
    tapCrate(container, unit);
  }
};

describe("Counting Crates canvas", () => {
  test("shows the order and starts with an empty tray", () => {
    const { container } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    expect(container.querySelector("[data-testid='order-total']")!.textContent).toBe("24");
    expect(trayTotalText(container)).toBe("0");
  });

  test("tapping a crate loads it and the running total moves", () => {
    const { container } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    tapCrate(container, 10);
    expect(trayTotalText(container)).toBe("10");
    tapCrate(container, 5);
    expect(trayTotalText(container)).toBe("15");
    tapCrate(container, 1);
    expect(trayTotalText(container)).toBe("16");
  });

  test("a crate in the tray can be tapped back out", () => {
    const { container } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    tapCrate(container, 10);
    const inTray = container.querySelector("[data-testid='tray'] button")!;
    fireEvent.click(inTray);
    expect(trayTotalText(container)).toBe("0");
  });

  test("going over the order is play, not a wrong answer", () => {
    const onAttempt = vi.fn();
    // Deliberately a constrained level. On an unconstrained one the board completes the
    // instant the total matches, so a child can only overshoot by stepping past it —
    // which ones-only crates never do.
    const { container } = render(
      <CountCratesCanvas question={question("crates_9")} isPlayMode onAttempt={onAttempt} />, // 22, exactly 4
    );
    tapCrate(container, 10);
    tapCrate(container, 10);
    tapCrate(container, 5);

    expect(trayTotalText(container)).toBe("25");
    // Exploring past the order is how a child learns to take one back out. Logging it as
    // an incorrect attempt is what sank mastery scores for anyone who explored.
    expect(onAttempt).not.toHaveBeenCalled();
  });

  test("filling the order reports the tray itself, once", async () => {
    const onSuccess = vi.fn();
    const onAttempt = vi.fn();
    const target = level("crates_6");
    const { container } = render(
      <CountCratesCanvas question={question("crates_6")} isPlayMode onSuccess={onSuccess} onAttempt={onAttempt} />,
    );

    fill(container, target);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onAttempt).toHaveBeenCalledTimes(1);

    const [outcome, payload] = onAttempt.mock.calls[0];
    expect(outcome).toBe("correct");
    // The shape `grade_count_crates` re-adds — crate sizes, not "I filled it".
    expect(Array.isArray(payload.selected)).toBe(true);
    expect(payload.selected.reduce((sum: number, crate: number) => sum + crate, 0))
      .toBe(target.orderTotal);
    expect(payload.details.levelId).toBe("crates_6");
    expect(payload.details.orderTotal).toBe(target.orderTotal);
  });

  test("filling a `fewest` order the long way still fills it", () => {
    // Same board as before the redesign, opposite expectation — and that is the point:
    // 37 counted correctly out of eleven crates is 37. The six-crate packing earns the
    // star; the long way earns the order.
    const onSuccess = vi.fn();
    const { container } = render(
      <CountCratesCanvas question={question("crates_11")} isPlayMode onSuccess={onSuccess} />,
    );

    tapCrate(container, 10);
    tapCrate(container, 10);
    tapCrate(container, 5);
    tapCrate(container, 5);
    for (let i = 0; i < 7; i++) tapCrate(container, 1);

    expect(trayTotalText(container)).toBe("37");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  test("a correct count is never refused for how it was packed", () => {
    // The report that forced this design change: order 26 built correctly out of eight
    // crates on a level that asks for five. It was refused — and the tray glowed green
    // while refusing. Filling the order is now filling the order; the crate count is a
    // star to chase, not a gate to fail.
    const onSuccess = vi.fn();
    const onAttempt = vi.fn();
    const { container } = render(
      <CountCratesCanvas question={question("crates_10")} isPlayMode onSuccess={onSuccess} onAttempt={onAttempt} />,
    );

    tapCrate(container, 10);
    tapCrate(container, 10);
    for (let i = 0; i < 6; i++) tapCrate(container, 1);

    expect(trayTotalText(container)).toBe("26");
    expect(onSuccess).toHaveBeenCalledTimes(1);

    const [, payload] = onAttempt.mock.calls[0];
    expect(payload.details.perfectPacking).toBe(false);   // no star
    expect(payload.details.packingGoal).toBe(5);   // this level invites exactly five
  });

  test("packing it tightly earns the star", async () => {
    const onAttempt = vi.fn();
    const target = level("crates_10");
    const { container } = render(
      <CountCratesCanvas question={question("crates_10")} isPlayMode onAttempt={onAttempt} />,
    );
    fill(container, target);

    await waitFor(() => expect(onAttempt).toHaveBeenCalledTimes(1));
    const [, payload] = onAttempt.mock.calls[0];
    expect(payload.details.perfectPacking).toBe(true);
    expect(container.querySelector("[data-testid='tray']")!.className).toContain("border-emerald-400");
  });

  test("no level opens with a shelf that cannot pay the order", () => {
    // Level 18 asked for 47 from 10s and 5s — buildable only by opening a crate, which is
    // why it read as broken. Every order is now reachable from the crates on the shelf, so
    // the "you must open something" prompt should never greet a child on a fresh board.
    for (const id of ["crates_16", "crates_17", "crates_18", "crates_19", "crates_20", "crates_23"]) {
      const { container, unmount } = render(<CountCratesCanvas question={question(id)} isPlayMode />);
      expect(container.querySelector("[data-testid='must-open']"), `${id} still needs an opening`)
        .toBeNull();
      unmount();
    }
  });

  test("overshooting says so, and says what to do about it", () => {
    const { container } = render(<CountCratesCanvas question={question("crates_9")} isPlayMode />);
    tapCrate(container, 10);
    tapCrate(container, 10);
    tapCrate(container, 5);   // 25, past an order of 22

    const stuck = container.querySelector("[data-testid='stuck']");
    expect(stuck, "a board that cannot reach the order must say so").toBeTruthy();
    expect(stuck!.textContent!.replace(/\s+/g, " ")).toContain("3 too many. Take a crate out.");
  });

  test("the prompt goes away once opening is no longer the obstacle", () => {
    // On a level whose order can be paid straight from the shelf, nothing should nag.
    const { container } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    expect(container.querySelector("[data-testid='must-open']")).toBeNull();
  });

  test("the whole board is operable from the keyboard", () => {
    const { container } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    const shelf = container.querySelector("[role='group']")!;

    // Arrow to move along the shelf, Enter to load — no pointer involved.
    fireEvent.keyDown(shelf, { key: "Enter" });
    expect(trayTotalText(container)).toBe("10");
    fireEvent.keyDown(shelf, { key: "ArrowRight" });
    fireEvent.keyDown(shelf, { key: "Enter" });
    expect(trayTotalText(container)).toBe("15");
    fireEvent.keyDown(shelf, { key: "Backspace" });
    expect(trayTotalText(container)).toBe("10");
  });

  test("the hint offers a move, and a second tap plays it", () => {
    const onHint = vi.fn();
    const { container, getByText } = render(
      <CountCratesCanvas question={question("crates_6")} isPlayMode onHint={onHint} />,
    );

    fireEvent.click(getByText("Hint"));
    expect(onHint).toHaveBeenCalledTimes(1);
    expect(onHint.mock.calls[0][0].reason).toMatch(/\d/);

    fireEvent.click(getByText("Hint"));
    expect(trayTotalText(container)).not.toBe("0");
  });

  test("undo takes the move back", () => {
    const { container, getByText } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    tapCrate(container, 10);
    expect(trayTotalText(container)).toBe("10");
    fireEvent.click(getByText("Undo"));
    expect(trayTotalText(container)).toBe("0");
  });

  test("opening a crate is offered only where the level allows it, and is spent once", () => {
    const { container: without } = render(<CountCratesCanvas question={question("crates_6")} isPlayMode />);
    expect(without.querySelector("[data-testid='opens-left']")).toBeNull();

    const { container: with_ } = render(<CountCratesCanvas question={question("crates_16")} isPlayMode />);
    expect(with_.querySelector("[data-testid='opens-left']")!.textContent).toContain("1 left");

    // The button now says what it does — "Open → 10×1" — because "Open" alone left an
    // adult, never mind a six-year-old, unable to see how 47 could come from 10s and 5s.
    const openButton = [...with_.querySelectorAll("button")].find(
      (element) => element.textContent?.trim().startsWith("Open →"),
    )!;
    expect(openButton).toBeTruthy();
    fireEvent.click(openButton);
    expect(with_.querySelector("[data-testid='opens-left']")!.textContent).toContain("0 left");
    // The budget is spent, so no crate offers to be opened any more.
    expect([...with_.querySelectorAll("button")].some((e) => e.textContent?.trim().startsWith("Open →")))
      .toBe(false);
  });
});
