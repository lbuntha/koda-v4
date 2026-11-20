import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodayPlanCard } from "./TodayPlanCard";
import type { TodayPlan } from "../../lib/todayPlan";

const plan: TodayPlan = {
  day: "2026-11-20",
  createdAt: "2026-11-20T02:00:00Z",
  reviewOn: true,
  steps: [
    { kind: "review", ref: "addition/count-on" },
    { kind: "fix", ref: "addition/doubles" },
    { kind: "read", bookId: "book-1", title: "My Cat" },
  ],
};
const label = (ref: string) => ({ title: ref === "addition/doubles" ? "Doubles" : "Count On", subject: "Addition" });

describe("Today's plan card", () => {
  it("shows progress and opens the first step not done with one button", () => {
    const onStart = vi.fn();
    render(<TodayPlanCard plan={plan} done={[true, false, false]} lessonLabel={label} onStart={onStart} />);
    expect(screen.getByText("1 of 3 done")).toBeTruthy();
    expect(screen.getByText("Fix a mistake")).toBeTruthy();
    expect(screen.getByText("My Cat")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Keep going/ }));
    expect(onStart).toHaveBeenCalledWith(plan.steps[1]);
  });

  it("says Start today before anything is done, and celebrates when all is done", () => {
    const { rerender } = render(<TodayPlanCard plan={plan} done={[false, false, false]} lessonLabel={label} onStart={() => {}} />);
    expect(screen.getByRole("button", { name: /Start today/ })).toBeTruthy();
    rerender(<TodayPlanCard plan={plan} done={[true, true, true]} lessonLabel={label} onStart={() => {}} />);
    expect(screen.queryByRole("button", { name: /Start today|Keep going/ })).toBeNull();
    expect(screen.getByText(/All done for today/)).toBeTruthy();
  });
});
