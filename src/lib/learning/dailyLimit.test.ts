import { beforeEach, describe, expect, it, vi } from "vitest";

const record = vi.fn();

vi.mock("./learningLog", async () => {
  const real = await vi.importActual<typeof import("./learningLog")>("./learningLog");
  return { ...real, LearningLog: { ...real.LearningLog, record: (event: unknown) => record(event) } };
});

const { noteDailyLimitReached } = await import("./dailyLimit");

beforeEach(() => {
  localStorage.clear();
  record.mockReset();
});

describe("telling the server the day's time is spent", () => {
  it("records one event per child per day, with no concept", () => {
    const at = new Date("2026-08-16T10:00:00");

    expect(noteDailyLimitReached(30, at, "l_mia")).toBe(true);
    expect(noteDailyLimitReached(30, new Date("2026-08-16T10:15:00"), "l_mia")).toBe(false);

    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];
    expect(event).toMatchObject({ type: "daily_limit_reached", limitMinutes: 30, learnerId: "l_mia", conceptKey: "" });
  });

  it("counts a new day, and another child, separately", () => {
    noteDailyLimitReached(30, new Date("2026-08-16T10:00:00"), "l_mia");
    noteDailyLimitReached(30, new Date("2026-08-17T10:00:00"), "l_mia");
    noteDailyLimitReached(30, new Date("2026-08-16T10:00:00"), "l_leo");

    expect(record).toHaveBeenCalledTimes(3);
  });
});
