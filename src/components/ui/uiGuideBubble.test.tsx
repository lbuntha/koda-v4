import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UIGuideBubble } from "./UIGuideBubble";

/**
 * The bubble Koda speaks through.
 *
 * Most of what is asserted here is about *pages*, because that is the part with
 * a wrong version that looks right: help long enough to need Back and Next is
 * help that can strand a child on page three of something they are no longer
 * being told.
 */

const pager = () => screen.queryByRole("button", { name: "Next" });
const page = () => screen.getByRole("status").querySelector("p")?.textContent;

describe("UIGuideBubble", () => {
  it("shows one instruction, announced, with a way out", () => {
    const onAction = vi.fn();
    render(<UIGuideBubble message="Touch the glowing one and say three." onAction={onAction} />);

    const panel = screen.getByRole("status");
    expect(panel.getAttribute("aria-live"), "it arrives unasked, so it is announced").toBe("polite");
    expect(page()).toBe("Touch the glowing one and say three.");
    expect(screen.getByText("Koda is helping")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("draws no pager for help that fits in a sentence", () => {
    render(<UIGuideBubble message="Start at the far left." />);
    expect(pager(), "one page is not a set of pages").toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("pages long help forwards and back, a step at a time", () => {
    render(<UIGuideBubble message={["Touch each one in order.", "Count as you go.", "The last number is how many."]} />);

    expect(page()).toBe("Touch each one in order.");
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled,
      "there is nothing before the first page",
    ).toBe(true);

    fireEvent.click(pager()!);
    expect(page()).toBe("Count as you go.");
    expect(screen.getByText("2/3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(pager()!);
    expect(page()).toBe("The last number is how many.");
    // Disabled rather than gone: a control that vanishes moves the next one
    // under a finger that is already on its way down.
    expect(pager()).not.toBeNull();
    expect((pager() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(page()).toBe("Count as you go.");
  });

  it("says where it is in words, not as a fraction", () => {
    render(<UIGuideBubble message={["One.", "Two."]} />);
    expect(screen.getByText("Step 1 of 2"), "what a screen reader reads out").toBeTruthy();
  });

  it("starts new help at the first page", () => {
    const { rerender } = render(<UIGuideBubble message={["First help, one.", "First help, two."]} />);
    fireEvent.click(pager()!);
    expect(page()).toBe("First help, two.");

    rerender(<UIGuideBubble message={["Second help, one.", "Second help, two."]} />);
    expect(page(), "different words are different help").toBe("Second help, one.");
  });

  it("holds its place while a live instruction rewords itself underneath", () => {
    const method = ["Touch each one in order.", "The last number is how many."];
    const { rerender } = render(
      <UIGuideBubble message={["Touch the glowing one and say three.", ...method]} resetKey={3} />,
    );

    fireEvent.click(pager()!);
    expect(page()).toBe("Touch each one in order.");

    // The child tapped: the coach is following them and page one now reads
    // differently. They are on page two and must stay there.
    rerender(<UIGuideBubble message={["Touch the glowing one and say four.", ...method]} resetKey={3} />);
    expect(page(), "still reading page two").toBe("Touch each one in order.");

    // A new rung, though, is new help — back to the top.
    rerender(<UIGuideBubble message={["Last one! Say five.", ...method]} resetKey={4} />);
    expect(page()).toBe("Last one! Say five.");
  });

  it("lets a caller own the position", () => {
    const onIndexChange = vi.fn();
    render(<UIGuideBubble message={["One.", "Two."]} index={0} onIndexChange={onIndexChange} />);

    fireEvent.click(pager()!);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(page(), "the caller moves it, not the click").toBe("One.");
  });

  it("points its tail at the work, above or below", () => {
    const { rerender, container } = render(<UIGuideBubble message="Hello" />);
    expect(container.querySelector("[aria-hidden=true].absolute")?.className).toContain("-bottom-");

    rerender(<UIGuideBubble message="Hello" tail="up" />);
    expect(container.querySelector("[aria-hidden=true].absolute")?.className).toContain("-top-");

    rerender(<UIGuideBubble message="Hello" tail="none" />);
    expect(container.querySelector("[aria-hidden=true].absolute")).toBeNull();
  });
});
