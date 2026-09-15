import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UISubjectLessonCard } from "./UISubjectLessonCard";

/**
 * A started subject on Home, drawn as the lesson it is on.
 *
 * Two targets and no more: the heading opens the subject, the card plays the
 * lesson. Pinned here because the two sit a few pixels apart and swapping their
 * handlers would still render identically.
 */

afterEach(cleanup);

const renderCard = () => {
  const onPlay = vi.fn();
  const onOpenSubject = vi.fn();
  render(
    <UISubjectLessonCard
      subject="Addition"
      category="operations"
      lessonTitle="Ten Frame"
      lessonNumber={19}
      completedLessons={18}
      lessonCount={52}
      onPlay={onPlay}
      onOpenSubject={onOpenSubject}
    />,
  );
  return { onPlay, onOpenSubject };
};

describe("a subject in progress on Home", () => {
  it("names the lesson, where it sits, and how far the subject is", () => {
    renderCard();

    expect(screen.getByText("Ten Frame")).toBeTruthy();
    expect(screen.getByText("Lesson 19")).toBeTruthy();
    expect(screen.getByText("18/52")).toBeTruthy();
  });

  it("plays the lesson from the card and opens the subject from its heading", () => {
    const { onPlay, onOpenSubject } = renderCard();

    expect(screen.getAllByRole("button")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Play Ten Frame/ }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onOpenSubject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open Addition" }));
    expect(onOpenSubject).toHaveBeenCalledTimes(1);
  });
});
