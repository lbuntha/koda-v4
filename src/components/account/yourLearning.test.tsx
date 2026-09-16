import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A student setting their own. The controls themselves are tested where they
 * live; what is asserted here is the wiring — that this writes the *learner's*
 * documents rather than a second per-account copy — and the voice, because a
 * screen that says "this child" to the person reading it is the whole reason
 * this section exists separately from the Children page.
 */

const setGoal = vi.fn();
const setSettings = vi.fn();
const patchLearner = vi.fn();
const verify = vi.fn();

let session: Record<string, unknown> | null = null;
const settings = {
  sessionMinutes: 20,
  allowedHours: null,
  aiHelpEnabled: true,
  goalCadence: "daily",
  startingPoint: "age",
  personaId: null,
};

vi.mock("../../lib/childSettings", () => ({
  ChildSettingsAPI: {
    subscribe: () => () => {},
    version: () => 1,
    for: () => settings,
    set: (learnerId: string, patch: unknown) => setSettings(learnerId, patch),
  },
}));

vi.mock("../../lib/dailyGoal", () => ({
  DailyGoalAPI: {
    subscribe: () => () => {},
    version: () => 1,
    for: () => 4,
    set: (learnerId: string, goal: number) => setGoal(learnerId, goal),
  },
}));

vi.mock("../../lib/useBilling", () => ({ useBilling: () => ({ ai: true }) }));

vi.mock("../../lib/sync", () => ({
  useSession: () => session,
  accessToken: () => Promise.resolve("t"),
  request: (path: string, init: unknown) => patchLearner(path, init),
  SessionAPI: { verify: () => verify() },
}));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: { list: { groupLabel: "" }, field: () => "" },
}));

// The fields are stubbed: their own behaviour is covered by the Children page,
// and what matters here is which document each one is handed.
vi.mock("./DailyGoalField", () => ({
  DailyGoalField: ({ value, onChange, hint }: { value: number; onChange(n: number): void; hint?: string }) => (
    <div>
      <p>{hint}</p>
      <button onClick={() => onChange(value + 1)}>goal up</button>
    </div>
  ),
}));

vi.mock("./ChildSettingsFields", () => ({
  ChildSettingsFields: ({
    voice,
    childAge,
    onChange,
  }: {
    voice?: string;
    childAge: number | null;
    onChange(patch: unknown): void;
  }) => (
    <div>
      <p>{`voice:${voice} age:${childAge}`}</p>
      <button onClick={() => onChange({ sessionMinutes: null })}>lift the limit</button>
    </div>
  ),
}));

const { YourLearning } = await import("./YourLearning");

beforeEach(() => {
  setGoal.mockReset();
  setSettings.mockReset();
  patchLearner.mockReset().mockResolvedValue({});
  verify.mockReset().mockResolvedValue(undefined);
  session = { userId: "u1", learnerId: "l_mia", learnerName: "Mia", learnerBirthYear: 2014, role: "student" };
});

describe("a student's own settings", () => {
  it("speaks to the learner, and knows their age", () => {
    render(<YourLearning learnerId="l_mia" />);

    expect(screen.getByText(/voice:self/)).toBeTruthy();
    expect(screen.getByText(/age:\d+/)).toBeTruthy();
    expect(screen.getByText("Rounds you aim to finish each day")).toBeTruthy();
  });

  it("writes the learner's own goal and settings", () => {
    render(<YourLearning learnerId="l_mia" />);

    fireEvent.click(screen.getByRole("button", { name: "goal up" }));
    fireEvent.click(screen.getByRole("button", { name: "lift the limit" }));

    expect(setGoal).toHaveBeenCalledWith("l_mia", 5);
    expect(setSettings).toHaveBeenCalledWith("l_mia", { sessionMinutes: null });
  });

  it("saves a new name when the field is left, not on every letter", async () => {
    render(<YourLearning learnerId="l_mia" />);
    const name = screen.getByDisplayValue("Mia");

    fireEvent.change(name, { target: { value: "Mia R" } });
    expect(patchLearner).not.toHaveBeenCalled();

    fireEvent.blur(name);

    await waitFor(() =>
      expect(patchLearner).toHaveBeenCalledWith(
        "/learners/l_mia",
        expect.objectContaining({ method: "PATCH", body: { displayName: "Mia R", birthYear: 2014 } }),
      ),
    );
    await waitFor(() => expect(verify).toHaveBeenCalled());
  });

  it("puts an emptied name back rather than saving nothing", async () => {
    render(<YourLearning learnerId="l_mia" />);
    const name = screen.getByDisplayValue("Mia");

    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.blur(name);

    expect(patchLearner).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByDisplayValue("Mia")).toBeTruthy());
  });
});
