import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCORING_DEFAULTS } from "../lib/scoring";
import { puzzleDay } from "./day";
import { dailySnapshot, resetDailyForTests, todaysPuzzle } from "./store";

vi.mock("../utils/audio", () => ({ isVoiceEnabled: () => false, playSound: vi.fn() }));
vi.mock("./store", async (orig) => ({ ...(await orig<typeof import("./store")>()), refreshDaily: vi.fn(async () => undefined) }));

import { WordGuessPage } from "./WordGuessPage";

beforeEach(() => {
  localStorage.clear();
  resetDailyForTests();
});

/** Today's English word on the line the page opens on. */
function todaysWord(level: number) {
  return todaysPuzzle(dailySnapshot(), { kind: "word-guess", lang: "en", level }, puzzleDay())!;
}

describe("Word Guess", () => {
  it("explains how to play first, and lets a child type a guess and check it", () => {
    const award = vi.fn();
    render(<WordGuessPage onExit={() => undefined} onAwardXp={award} />);
    fireEvent.click(screen.getByRole("button", { name: /English/ }));
    expect(screen.getByText(/How to play/, { selector: "h2,h3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Got it/ }));

    const length = screen.getByRole("group", { name: /Word length/ });
    const level = Number(within(length).getByRole("button", { pressed: true }).textContent?.match(/\d/)?.[0]);
    const word = todaysWord(level);
    for (const key of [...word.data.word, "Enter"]) act(() => void fireEvent.keyDown(window, { key }));
    expect(screen.getByText("Wow, first try!")).toBeTruthy();
    expect(screen.getAllByText(new RegExp(`^${word.data.word}$`, "i")).length).toBeGreaterThan(0);
    // Three stars, the same full round XP as a lesson (Settings' default here).
    expect(award).toHaveBeenCalledWith(SCORING_DEFAULTS.xpPerLevel);
    expect(screen.queryByRole("button", { name: /Check/ })).toBeNull();
  });

  it("asks for the whole word before checking", () => {
    render(<WordGuessPage onExit={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /English/ }));
    fireEvent.click(screen.getByRole("button", { name: /Got it/ }));
    for (const key of ["a", "Enter"]) act(() => void fireEvent.keyDown(window, { key }));
    expect(screen.getByText(/Fill all \d boxes first/)).toBeTruthy();
  });
});
