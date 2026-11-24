import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { UILevelUp } from "./UILevelUp";

/**
 * The one level-up moment every activity shares. What matters: it says which
 * level in words, it gets out of the way on a tap or Escape, and it is not
 * there at all when there is nothing to celebrate.
 */
describe("UILevelUp", () => {
  it("names the level reached and closes from its button", () => {
    const onClose = vi.fn();
    render(<UILevelUp level={5} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Level 5!" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Keep going" });
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on the backdrop, but not on the card", () => {
    const onClose = vi.fn();
    render(<UILevelUp level={3} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("level-up"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByTestId("level-up").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("draws nothing when no level was reached", () => {
    render(<UILevelUp level={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
