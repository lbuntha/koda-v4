import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UILessonCard } from "./UILessonCard";

/**
 * The Today band's card, in both of the shapes it has.
 *
 * The shape itself is CSS — a phone gets a row, 640px and up gets the card —
 * and jsdom draws no CSS, so what is pinned here is what survives the shape
 * change: one control per card whichever variant it is, the reason still
 * readable, and a progress bar that replaces the prose rather than joining it.
 */

vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));

afterEach(cleanup);

describe("a lesson offered on Today", () => {
  it("is one control, not a card with a button inside it", () => {
    // The card *is* the button. A nested one would give a child two targets
    // for the same action, one of which swallows the other's clicks.
    render(
      <UILessonCard title="Number Bonds" subject="Addition" tone="advance" onClick={() => {}} />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("is still one control as a compact row", () => {
    render(
      <UILessonCard
        variant="compact"
        title="Make a Hundred"
        subject="Counting"
        message="Let's warm up with something you already know!"
        tone="review"
        onClick={() => {}}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    // The reason is drawn twice — as the corner chip the card wears and on the
    // subject line the row wears — and CSS shows exactly one of them. Both must
    // exist, or one of the two widths loses the only thing telling the three
    // cards apart.
    expect(screen.getAllByText("Warm up").length).toBeGreaterThanOrEqual(2);
  });

  it("shows how far a half-finished round got, in place of the encouragement", () => {
    render(
      <UILessonCard
        title="Number Bonds"
        subject="Addition"
        message="One more round to make it stick!"
        progress={{ answered: 7, total: 8 }}
        tone="resume"
        actionLabel="Carry on"
        onClick={() => {}}
      />,
    );

    expect(screen.getByText(/Question 7 of 8/)).toBeTruthy();
    // Not both: a bar, a count and a sentence saying the same thing is three
    // versions of one fact on a card the size of a postcard.
    expect(screen.queryByText(/make it stick/)).toBeNull();
    expect(screen.getByText("Carry on")).toBeTruthy();
  });

  it("says nothing about progress on a lesson that has none", () => {
    render(
      <UILessonCard
        title="Make a Hundred"
        subject="Counting"
        message="Ready for something new?"
        onClick={() => {}}
      />,
    );

    expect(screen.queryByText(/Question \d+ of/)).toBeNull();
    expect(screen.getByText("Ready for something new?")).toBeTruthy();
  });
});
