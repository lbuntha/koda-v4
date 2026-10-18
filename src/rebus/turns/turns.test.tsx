import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OFFICIAL_PUZZLES } from "../content";
import { DEFAULT_SETTINGS } from "../settings";
import { TurnsHome } from "./TurnsHome";

vi.mock("../../utils/audio", () => ({ isVoiceEnabled: () => false, playSound: () => {} }));

/** Puzzles whose answer is just the pictures' names run together, so the test can read the answer off the screen. */
const spoken = (p: (typeof OFFICIAL_PUZZLES)[number]) => p.pieces.flatMap((x) => (x.kind === "icon" ? [x.name] : [])).join("");
const puzzles = OFFICIAL_PUZZLES.filter((p) => p.category === "food" && p.pieces.every((x) => x.kind === "icon" || x.kind === "op") && spoken(p) === p.answer.toLowerCase().replace(/\s/g, ""));
const counts = Object.fromEntries([...new Set(puzzles.map((p) => p.category))].map((c) => [c, puzzles.filter((p) => p.category === c).length]));
const mount = (onExit = () => {}) => render(<TurnsHome puzzles={puzzles} counts={counts} settings={DEFAULT_SETTINGS} onExit={onExit} />);

const answerOnScreen = (): string => {
  const names = [...screen.getByRole("group", { name: "Puzzle" }).querySelectorAll("[role=img]")].map((n) => n.getAttribute("aria-label"));
  const joined = names.join("");
  return puzzles.find((p) => spoken(p) === joined)?.answer ?? puzzles[0].answer;
};

beforeEach(() => localStorage.clear());

describe("taking turns on one device", () => {
  it("starts with two players, lets a third join, and needs no network", () => {
    mount();
    expect(screen.getByText("Works with no internet. Nothing is saved to anyone's account.")).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: "Add a player" }));
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
  });

  it("hands the device over, runs one player's turn, shows the answer, then hands it to the next player", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    // Nothing is running until the first player says they are ready.
    expect(screen.getByRole("status").textContent).toContain("Pass to");
    fireEvent.click(screen.getByRole("button", { name: "I'm ready" }));
    expect(screen.getByRole("status").textContent).toContain("turn");

    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: answerOnScreen() } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    // The reveal names who got it, and offers a hand-over to the other player.
    expect(screen.getByText(/got it!/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Pass to / }));
    expect(screen.getByRole("button", { name: "I'm ready" })).toBeTruthy();
  });

  it("plays to the end, shows a podium, and can start again or leave", () => {
    mount();
    fireEvent.click(screen.getByRole("tab", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "I'm ready" }));
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      fireEvent.click(screen.getByRole("button", { name: /^Pass to |See results/ }));
    }
    expect(screen.getByRole("list", { name: "The podium" })).toBeTruthy();
    // Nobody scored, so it is a tie.
    expect(screen.getByText("It's a tie!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});
