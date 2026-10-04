import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UIProgressBar } from "./UIProgressBar";

describe("UIProgressBar", () => {
  it("is a named progress bar when labelled", () => {
    render(<UIProgressBar value={3} max={15} label="Counting" />);

    const bar = screen.getByRole("progressbar", { name: "Counting" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("15");
  });

  it("is decoration when unlabelled, for rows that say the count as text", () => {
    render(<UIProgressBar value={3} max={15} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("clamps the value and shows the caption", () => {
    render(<UIProgressBar value={20} max={15} label="Counting" caption="3 of 15 lessons complete" />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("15");
    expect(screen.getByText("3 of 15 lessons complete")).toBeTruthy();
  });
});
