import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodayPlanCard, planMessage } from "./TodayPlanCard";
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
  it("shows the XP earned today, and nothing while it is still 0", () => {
    const { rerender } = render(<TodayPlanCard plan={plan} done={[false, false, false]} lessonLabel={label} onStart={() => {}} />);
    expect(screen.queryByTestId("xp-today")).toBeNull();
    rerender(<TodayPlanCard plan={plan} done={[true, false, false]} lessonLabel={label} onStart={() => {}} xpToday={25} />);
    expect(screen.getByTestId("xp-today").textContent).toBe("+25 XP today");
  });

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

  it("welcomes a child back after a break", () => {
    render(<TodayPlanCard plan={{ ...plan, welcomeBack: true }} done={[false, false, false]} lessonLabel={label} onStart={() => {}} />);
    expect(screen.getByText(/Welcome back!/)).toBeTruthy();
  });

  it("picks one cheer line: welcome back, then mistakes waiting, then the streak", () => {
    const daily = { count: 4, cadence: "daily" as const };
    expect(planMessage({ ...plan, welcomeBack: true }, [false, false, false], daily)?.key).toBe("todayPlan.welcomeBack");
    expect(planMessage(plan, [false, false, false], daily)).toEqual({ key: "todayPlan.cheer.oneMistake" });
    expect(planMessage(plan, [false, true, false], daily)).toEqual({ key: "todayPlan.cheer.streak", values: { n: "4" } });
    expect(planMessage(plan, [false, true, false], { count: 4, cadence: "weekly" })).toBeNull();
    expect(planMessage(plan, [true, true, true], daily)).toEqual({ key: "todayPlan.cheer.doneStreak", values: { n: "4" } });
  });

  it("shows the line on the card", () => {
    render(<TodayPlanCard plan={plan} done={[true, false, false]} lessonLabel={label} onStart={() => {}} streak={{ count: 3, cadence: "daily" }} />);
    expect(screen.getByText("1 mistake is waiting to be fixed. You can do it!")).toBeTruthy();
  });
});
