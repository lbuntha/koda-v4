import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const motion = vi.hoisted(() => ({ ok: true }));
vi.mock("../motion", async (orig) => ({ ...(await orig<typeof import("../motion")>()), useMotionOK: () => motion.ok }));

import { HowToPlay, forgetHowToPlay, hasSeenHowToPlay, markHowToPlaySeen, useHowToPlay, type DemoStep } from "./HowToPlay";

const steps: DemoStep[] = [
  { caption: "First, look.", holdMs: 1000 },
  { caption: "Then tap.", hand: [[0.5, 0.5]], taps: 2, moveMs: 800, holdMs: 1000 },
  { caption: "Then drag.", hand: [[0.1, 0.1], [0.9, 0.9]], moveMs: 800, holdMs: 1000 },
];

const scene = (step: number, phase: string) => <span data-testid="scene">{`${step}:${phase}`}</span>;

describe("How to play", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    forgetHowToPlay();
    motion.ok = true;
  });

  /** Run the clock in small ticks, so each timer the demo sets after a step is run too. */
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 50) act(() => { vi.advanceTimersByTime(50); });
  };

  it("plays every step in order, saying each caption once, then offers to play", () => {
    const speak = vi.fn();
    render(<HowToPlay open steps={steps} scene={scene} onClose={() => {}} speak={speak} />);
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("First, look.");
    expect(screen.getByTestId("how-to-play-step").textContent).toBe("Step 1 of 3");
    expect(screen.getByTestId("scene").textContent).toBe("0:done");
    advance(1000);
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("Then tap.");
    expect(screen.getByTestId("scene").textContent).toBe("1:start");
    advance(450);
    expect(screen.getByTestId("scene").textContent).toBe("1:move");
    advance(800);
    expect(screen.getByTestId("scene").textContent).toBe("1:done");
    advance(1000 + 450 + 800 + 1000);
    expect(screen.getByRole("button", { name: "Let's play!" })).toBeTruthy();
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("Now you try!");
    expect(speak.mock.calls.map((c) => c[0])).toEqual(["First, look.", "Then tap.", "Then drag."]);
  });

  it("draws the hand only for steps that have one", () => {
    render(<HowToPlay open steps={steps} scene={scene} onClose={() => {}} />);
    expect(screen.queryByTestId("how-to-play-hand")).toBeNull();
    advance(1000);
    expect(screen.getByTestId("how-to-play-hand")).toBeTruthy();
  });

  it("with reduced motion draws no hand and shows each result at once, for longer", () => {
    motion.ok = false;
    render(<HowToPlay open steps={steps} scene={scene} onClose={() => {}} />);
    advance(1000);
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("Then tap.");
    expect(screen.getByTestId("scene").textContent).toBe("1:done");
    expect(screen.queryByTestId("how-to-play-hand")).toBeNull();
    advance(2000);
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("Then tap.");
    advance(700);
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("Then drag.");
  });

  it("starts again from the first step on Watch again", () => {
    render(<HowToPlay open steps={steps} scene={scene} onClose={() => {}} />);
    advance(20_000);
    fireEvent.click(screen.getByRole("button", { name: "Watch again" }));
    expect(screen.getByTestId("how-to-play-caption").textContent).toBe("First, look.");
  });

  it("closes on Skip, at any step", () => {
    const onClose = vi.fn();
    render(<HowToPlay open steps={steps} scene={scene} onClose={onClose} />);
    advance(1500);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("draws nothing when closed", () => {
    render(<HowToPlay open={false} steps={steps} scene={scene} onClose={() => {}} />);
    expect(screen.queryByTestId("how-to-play")).toBeNull();
  });
});

describe("watching once", () => {
  afterEach(() => forgetHowToPlay());

  it("opens by itself the first time, and not after it was closed", () => {
    const first = renderHook(() => useHowToPlay("demo-skill", true));
    expect(first.result.current.open).toBe(true);
    act(() => first.result.current.close());
    expect(first.result.current.open).toBe(false);
    expect(hasSeenHowToPlay("demo-skill")).toBe(true);
    const again = renderHook(() => useHowToPlay("demo-skill", true));
    expect(again.result.current.open).toBe(false);
    act(() => again.result.current.show());
    expect(again.result.current.open).toBe(true);
  });

  it("never opens by itself where auto is off, such as practice or a race", () => {
    expect(renderHook(() => useHowToPlay("quiet-skill", false)).result.current.open).toBe(false);
  });

  it("remembers each skill separately", () => {
    markHowToPlaySeen("one");
    expect(hasSeenHowToPlay("one")).toBe(true);
    expect(hasSeenHowToPlay("two")).toBe(false);
  });
});
