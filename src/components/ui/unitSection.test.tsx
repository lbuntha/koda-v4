import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UIUnitSection } from "./UIUnitSection";

/**
 * A unit of the learning path, folded or open.
 *
 * The page decides which unit is open; the section only has to draw that
 * honestly — lessons present exactly when it says it is expanded — and hand the
 * tap back.
 */

afterEach(cleanup);

const renderSection = (open: boolean) => {
  const onToggle = vi.fn();
  render(
    <UIUnitSection
      id="u5"
      marker={1}
      eyebrow="Unit 1"
      title="Putting Groups Together"
      done={1}
      total={4}
      open={open}
      onToggle={onToggle}
    >
      <p>Count Them All</p>
    </UIUnitSection>,
  );
  return { onToggle };
};

describe("a unit on the learning path", () => {
  it("shows its lessons only while open, and says which it is", () => {
    renderSection(true);
    const header = screen.getByRole("button", { name: /Putting Groups Together/ });

    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Count Them All")).toBeTruthy();
  });

  it("folds to its name and count, and hands the tap back", () => {
    const { onToggle } = renderSection(false);
    const header = screen.getByRole("button", { name: /Putting Groups Together/ });

    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Count Them All")).toBeNull();
    expect(screen.getByText("1/4")).toBeTruthy();

    fireEvent.click(header);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
