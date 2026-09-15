import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UIBanner } from "./UIBanner";

afterEach(() => vi.useRealTimers());

describe("UIBanner", () => {
  it("shows the message and title, announced politely", () => {
    render(<UIBanner title="New on Koda">Colour Sweeper is out.</UIBanner>);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("New on Koda")).toBeTruthy();
    expect(screen.getByText("Colour Sweeper is out.")).toBeTruthy();
  });

  it("draws no close button unless it can be dismissed", () => {
    render(<UIBanner>Hello</UIBanner>);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("fades out, then goes and tells the caller", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <UIBanner onDismiss={onDismiss} dismissLabel="Close">
        Hello
      </UIBanner>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Hello")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("runs its one action", () => {
    const onClick = vi.fn();
    render(<UIBanner action={{ label: "Try it", onClick }}>A new skill is out.</UIBanner>);

    fireEvent.click(screen.getByRole("button", { name: "Try it" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sits on the theme's surface, with the tone on the icon only", () => {
    for (const tone of ["primary", "streak", "success", "danger"] as const) {
      const { unmount } = render(
        <UIBanner tone={tone} icon={<svg data-testid="icon" />}>
          {tone}
        </UIBanner>,
      );
      const card = screen.getByRole("status");
      expect(card.className).toContain("bg-surface");
      expect(card.className).toContain("border-line");
      expect(card.className).not.toMatch(/gradient|from-|shadow-/);
      expect(screen.getByTestId("icon").parentElement!.className).toMatch(/dark:text-/);
      unmount();
    }
  });
});
