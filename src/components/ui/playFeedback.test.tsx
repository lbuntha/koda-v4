import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UIChoiceGrid, UICountdown, UICountUp, UIHintPanel, UIOutcome, UIPointsPop, UIXpReward, isLowTime } from "./index";

afterEach(() => vi.useRealTimers());

describe("UICountdown", () => {
  it("is calm with plenty of time, urgent in the last seconds, and an hourglass when out", () => {
    expect(isLowTime(30, 60)).toBe(false);
    expect(isLowTime(10, 60)).toBe(true);
    expect(isLowTime(11, 30)).toBe(false);
    expect(isLowTime(6, 30)).toBe(true);
    expect(isLowTime(0, 60)).toBe(false);

    const { rerender } = render(<UICountdown secondsLeft={40} totalSeconds={60} label="40 seconds left" />);
    const timer = screen.getByRole("timer", { name: "40 seconds left" });
    expect(timer.className).not.toContain("ui-tick");
    expect(timer.textContent).toBe("40");
    rerender(<UICountdown secondsLeft={5} totalSeconds={60} label="5 seconds left" />);
    expect(screen.getByRole("timer").className).toContain("ui-tick");
    rerender(<UICountdown secondsLeft={0} totalSeconds={60} label="Out of time" />);
    expect(screen.getByRole("timer").textContent).toBe("");
    expect(screen.getByRole("timer").querySelector("svg.lucide-hourglass")).toBeTruthy();
  });
});

describe("UIHintPanel", () => {
  const base = { delaySec: 15, totalRungs: 3, hintTitle: (n: number) => `Hint ${n}`, progressLabel: "1 of 3 hints used", buttonLabel: "Get a hint", onTake: () => {} };

  it("shows each hint taken as its own numbered card, and counts them in dots", () => {
    render(<UIHintPanel {...base} status={{ state: "ready", rung: 2 }} hints={[{ rung: 1, text: "Category: food" }]} />);
    expect(screen.getByText("Hint 1")).toBeTruthy();
    expect(screen.getByText("Category: food")).toBeTruthy();
    expect(screen.getByRole("img", { name: "1 of 3 hints used" }).children).toHaveLength(3);
  });

  it("can be pressed when ready, and not while locked or used up", () => {
    const take = vi.fn();
    const { rerender } = render(<UIHintPanel {...base} onTake={take} status={{ state: "ready", rung: 1 }} hints={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Get a hint" }));
    expect(take).toHaveBeenCalledTimes(1);
    rerender(<UIHintPanel {...base} onTake={take} status={{ state: "locked", secondsLeft: 9 }} hints={[]} />);
    expect((screen.getByRole("button", { name: "Get a hint" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<UIHintPanel {...base} onTake={take} status={{ state: "exhausted" }} hints={[]} />);
    expect((screen.getByRole("button", { name: "Get a hint" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("UIOutcome", () => {
  it("celebrates a correct answer with its points, and stays calm when time is up or it was passed", () => {
    const { rerender } = render(<UIOutcome kind="correct" title="You got it!" points={3} pointsLabel="+3 points" />);
    expect(screen.getByRole("status").textContent).toContain("You got it!");
    expect(screen.getByText("+3 points")).toBeTruthy();
    rerender(<UIOutcome kind="timeUp" title="Time's up" message="Here is the answer." points={3} />);
    // No points chip unless it was a win.
    expect(screen.queryByText("+3")).toBeNull();
    expect(screen.getByRole("status").querySelector(".ui-shake")).toBeTruthy();
  });

  it("offers one next action", () => {
    const next = vi.fn();
    render(<UIOutcome kind="skipped" title="Skipped" actionLabel="Next puzzle" onAction={next} />);
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    expect(next).toHaveBeenCalled();
  });
});

describe("UICountUp", () => {
  it("shows the right number at once when motion is off, and also with no matchMedia", () => {
    const { rerender } = render(<UICountUp value={3} />);
    expect(screen.getByText("3")).toBeTruthy();
    rerender(<UICountUp value={9} />);
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("climbs to the new value and lands exactly on it when motion is allowed", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { rerender } = render(<UICountUp value={0} />);
    rerender(<UICountUp value={28} durationMs={500} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(250)));
    const mid = Number(screen.getByText(/^\d+$/).textContent);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(28);
    await act(async () => void (await vi.advanceTimersByTimeAsync(600)));
    expect(screen.getByText("28")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe("UIXpReward and UIPointsPop", () => {
  it("writes the final XP for a screen reader while the visible number climbs", () => {
    render(<UIXpReward xp={28} title="Nice work!" format={(n) => `+${n} XP`} />);
    expect(screen.getByRole("img", { name: "+28 XP" })).toBeTruthy();
    expect(screen.getByText("Nice work!")).toBeTruthy();
  });

  it("is decoration that screen readers skip", () => {
    const { container } = render(<div className="relative"><UIPointsPop>+3</UIPointsPop></div>);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("+3");
  });
});

describe("UIChoiceGrid", () => {
  const options = ["Paris", "Rome", "Madrid"];

  it("lists the answers as big lettered buttons and says which was tapped", () => {
    const pick = vi.fn();
    render(<UIChoiceGrid label="Choose your answer" options={options} onPick={pick} />);
    expect(screen.getByRole("group", { name: "Choose your answer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Rome/ }));
    expect(pick).toHaveBeenCalledWith("Rome");
  });

  it("crosses out a wrong answer so it cannot be tapped again, and ticks the right one", () => {
    const pick = vi.fn();
    const { rerender } = render(<UIChoiceGrid label="Choose" options={options} tried={new Set(["Rome"])} onPick={pick} />);
    const rome = screen.getByRole("button", { name: /Rome/ }) as HTMLButtonElement;
    expect(rome.disabled).toBe(true);
    expect(rome.className).toContain("line-through");
    fireEvent.click(rome);
    expect(pick).not.toHaveBeenCalled();
    rerender(<UIChoiceGrid label="Choose" options={options} chosen="Paris" onPick={pick} />);
    // Once one is chosen the others stand still.
    for (const b of screen.getAllByRole("button")) expect((b as HTMLButtonElement).disabled).toBe(true);
  });
});
