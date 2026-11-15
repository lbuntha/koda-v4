import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * The front door: a new visitor reads the promise and the four parent worries,
 * and one tap takes them to Create account (or Sign in for a returning family).
 */

vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));

const { LandingPage } = await import("./LandingPage");

describe("LandingPage", () => {
  it("says what Koda is and answers the parent worries", () => {
    render(<LandingPage onStart={vi.fn()} onSignIn={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Help your child read and write Khmer" })).toBeTruthy();
    expect(screen.getByText("My child speaks English, not Khmer.")).toBeTruthy();
    expect(screen.getByText("Tutors and extra classes cost too much.")).toBeTruthy();
    expect(screen.getByText("I don't know what my child studied.")).toBeTruthy();
    expect(screen.getByText("My child won't sit down to study.")).toBeTruthy();
    expect(screen.getByText("Daily time limit")).toBeTruthy();
  });

  it("starts sign-up from either Start button, and sign-in from the header", () => {
    const onStart = vi.fn();
    const onSignIn = vi.fn();
    render(<LandingPage onStart={onStart} onSignIn={onSignIn} />);
    const starts = screen.getAllByRole("button", { name: /Start free/ });
    expect(starts).toHaveLength(3); // hero, closing card, footer
    starts.forEach((button) => fireEvent.click(button));
    expect(onStart).toHaveBeenCalledTimes(3);
    screen.getAllByRole("button", { name: "Sign in" }).forEach((button) => fireEvent.click(button));
    expect(onSignIn).toHaveBeenCalledTimes(2); // header and footer
  });
});
