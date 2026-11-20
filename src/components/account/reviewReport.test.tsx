import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ReviewReport } from "./ReviewReport";

const names = (_skillId: string, lessonId: string) => (lessonId === "doubles" ? { lesson: "Doubles", skill: "Addition" } : null);

describe("the mistakes section of a child's report", () => {
  beforeEach(() => localStorage.clear());

  it("draws nothing for a child with no mistakes yet", () => {
    const { container } = render(<ReviewReport learnerId="kid" learnerName="Dara" lessonName={names} />);
    expect(container.innerHTML).toBe("");
  });

  it("lists open mistakes with a real example, and counts what was fixed", () => {
    const today = new Date();
    const day = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
    localStorage.setItem(
      "koda_review_v1__kid",
      JSON.stringify({
        version: 1,
        mistakes: {
          "addition/doubles": { key: "addition/doubles", skillId: "addition", lessonId: "doubles", activityId: "a", conceptKey: "c", examples: [{ day, given: "7", expected: "8" }], firstDay: day, lastWrongDay: day, misses: 2, rightDays: [], dueDay: "2099-01-01" },
        },
        topics: {},
        fixed: [{ key: "addition/bonds", conceptKey: "b", day }],
      }),
    );
    render(<ReviewReport learnerId="kid" learnerName="Dara" lessonName={names} />);
    expect(screen.getByText("Doubles")).toBeTruthy();
    expect(screen.getByText("Answered 7; the answer was 8.")).toBeTruthy();
    expect(screen.getByText("Fixed this week").previousElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Still to fix").previousElementSibling?.textContent).toBe("1");
  });
});
