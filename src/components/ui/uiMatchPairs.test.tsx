import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { UIMatchPairs } from "./UIMatchPairs";

const PAIRS = [
  { left: "Where?", right: "the market" },
  { left: "What?", right: "a mango" },
  { left: "How?", right: "walk" },
];

function Board({ onMiss = () => {} }: { onMiss?(l: number, r: number): void }) {
  const [joined, setJoined] = useState<Record<number, number>>({});
  return (
    <UIMatchPairs
      pairs={PAIRS}
      order={[2, 0, 1]}
      joined={joined}
      onJoin={(i) => setJoined((j) => ({ ...j, [i]: Object.keys(j).length }))}
      onMiss={onMiss}
      leftLabel="Questions"
      rightLabel="Answers"
    />
  );
}

describe("UIMatchPairs", () => {
  it("joins a question to its answer from either side, and draws a string for each pair", () => {
    const { container } = render(<Board />);
    expect(container.querySelectorAll("[data-match-strings] path")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Where?" }));
    fireEvent.click(screen.getByRole("button", { name: "the market" }));
    fireEvent.click(screen.getByRole("button", { name: "a mango" }));
    fireEvent.click(screen.getByRole("button", { name: "What?" }));
    expect(container.querySelectorAll("[data-match-strings] path")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "the market" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reports a wrong pairing and joins nothing", () => {
    const onMiss = vi.fn();
    const { container } = render(<Board onMiss={onMiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Where?" }));
    fireEvent.click(screen.getByRole("button", { name: "walk" }));
    expect(onMiss).toHaveBeenCalledWith(0, 2);
    expect(container.querySelectorAll("[data-match-strings] path")).toHaveLength(0);
  });
});
