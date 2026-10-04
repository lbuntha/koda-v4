import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UIRewardProgress } from "./UIRewardProgress";

describe("UIRewardProgress", () => {
  it("is a named progress bar reading as a count", () => {
    render(<UIRewardProgress value={3} max={10} label="Daily quest" />);

    const bar = screen.getByRole("progressbar", { name: "Daily quest" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
    expect(bar.getAttribute("aria-valuetext")).toBe("3 / 10");
  });

  it("keeps the count inside 0..max", () => {
    render(<UIRewardProgress value={14} max={10} label="Quest" />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10");
  });

  it("draws a chest by default and none when the reward is null", () => {
    const { container, rerender } = render(<UIRewardProgress value={0} max={10} label="Quest" />);
    expect(container.querySelector("svg")).toBeTruthy();

    rerender(<UIRewardProgress value={0} max={10} label="Quest" reward={null} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
