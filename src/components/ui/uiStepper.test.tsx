import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UIStepper } from "./UIStepper";

const steps = [
  { id: "a", label: "Source", complete: true },
  { id: "b", label: "Review" },
  { id: "c", label: "Publish", disabled: true },
];

describe("UIStepper", () => {
  it("marks the current step and names every step", () => {
    render(<UIStepper steps={steps} current={1} onSelect={() => {}} label="Steps" />);

    expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Review/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: /Source/ })).toBeTruthy();
  });

  it("goes to a step when pressed, never to a locked one", () => {
    const onSelect = vi.fn();
    render(<UIStepper steps={steps} current={1} onSelect={onSelect} label="Steps" />);

    fireEvent.click(screen.getByRole("button", { name: /Source/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
    expect((screen.getByRole("button", { name: /Publish/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
