import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UISkillCard } from "./UISkillCard";

/**
 * The shared skill card, in the two shapes the catalogue uses.
 *
 * The row is not a smaller poster: it is what a phone gets, and on a phone the
 * catalogue is also where a skill is *added*, so the row has to be able to say
 * so. The rest of what is pinned here is subtraction — one progress figure
 * rather than two — which is easy to reintroduce and invisible in a diff.
 */

vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));

const base = {
  title: "Addition",
  tagline: "Put groups together, then learn the shortcuts.",
  category: "operations",
  lessonCount: 56,
  onOpen: () => {},
};

afterEach(cleanup);

describe("a skill as a row", () => {
  it("carries the sentence a learner is deciding on", () => {
    render(<UISkillCard size="sm" {...base} completedLessons={1} />);

    expect(screen.getByText("Addition")).toBeTruthy();
    expect(screen.getByText(/Put groups together/)).toBeTruthy();
    expect(screen.getByText("1/56")).toBeTruthy();
  });

  it("offers to add a skill the learner does not have yet, and adds it when pressed", () => {
    const onRegister = vi.fn();
    const onOpen = vi.fn();
    render(
      <UISkillCard
        size="sm"
        {...base}
        onOpen={onOpen}
        registered={false}
        onRegister={onRegister}
      />,
    );

    expect(screen.getByText("Add")).toBeTruthy();
    // Pressing the row means the same thing pressing the poster means. Opening
    // a skill nobody has added is the wrong destination, not a shortcut.
    screen.getByRole("button", { name: /Add Addition/ }).click();
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("says nothing about adding a skill that is already the learner's", () => {
    render(<UISkillCard size="sm" {...base} completedLessons={1} />);

    expect(screen.queryByText("Add")).toBeNull();
  });
});

describe("a skill as a poster", () => {
  it("states progress once, not as a count and a percentage", () => {
    render(<UISkillCard size="md" {...base} completedLessons={1} />);

    expect(screen.getByText("1 of 56")).toBeTruthy();
    expect(screen.queryByText("2%")).toBeNull();
  });

  it("counts the lessons instead when none of them are done", () => {
    render(<UISkillCard size="md" {...base} completedLessons={0} />);

    expect(screen.getByText(/56 lessons/)).toBeTruthy();
    expect(screen.queryByText(/of 56/)).toBeNull();
  });
});
