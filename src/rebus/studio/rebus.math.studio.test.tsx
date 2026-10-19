import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePanel } from "./CreatePanel";
import { StudioAPI } from "./studioApi";

vi.mock("./studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studioApi")>("./studioApi");
  return { ...actual, StudioAPI: { create: vi.fn() } };
});
const api = vi.mocked(StudioAPI);

beforeEach(() => api.create.mockReset());

const startMath = () => {
  render(<CreatePanel onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Write one myself/ }));
  fireEvent.click(screen.getByRole("radio", { name: /^Math/ }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
};

describe("writing a math question", () => {
  it("shows the question and its answer as the child will meet them, worked out from the numbers", () => {
    startMath();
    expect(screen.getByText("6 × 7 = ?")).toBeTruthy();
    expect(screen.getByText("Answer: 42")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Second number"), { target: { value: "9" } });
    expect(screen.getByText("6 × 9 = ?")).toBeTruthy();
    expect(screen.getByText("Answer: 54")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "The second number" }));
    expect(screen.getByText("6 × ? = 54")).toBeTruthy();
    expect(screen.getByText("Answer: 9")).toBeTruthy();
    // There is no answer box to mistype.
    expect(screen.queryByLabelText("Answer")).toBeNull();
  });

  it("says why numbers do not make a question, and will not go on", () => {
    startMath();
    fireEvent.change(screen.getByLabelText("Sum"), { target: { value: "÷" } });
    fireEvent.change(screen.getByLabelText("Second number"), { target: { value: "4" } });
    expect(screen.getAllByRole("alert")[0].textContent).toContain("division must come out even");
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/To continue: .*division must come out even/)).toBeTruthy();
  });

  it("saves the numbers, not a typed answer", async () => {
    api.create.mockResolvedValue({ status: "draft", pieces: [{ kind: "word", text: "6 × 7 = ?" }] } as never);
    startMath();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({ kind: "math", category: "math", math: { a: 6, op: "×", b: 7, unknown: "result" }, answer: "42", approve: false });
  });
});

describe("a saved question on the Studio card", () => {
  it("names its kind and lists a multiple-choice question's answers with the right one ticked", async () => {
    const { PuzzleCard } = await import("./PuzzleCard");
    const choice = {
      id: "q", category: "countries", ages: [7, 12], difficulty: 1, trick: "compound", kind: "choice", choice: { options: ["Paris", "Rome"], correct: 1 },
      pieces: [{ kind: "word", text: "Capital of Italy?" }], answer: "Rome", accepts: [], explanation: "Rome is the capital.", source: "official",
      status: "draft", seeded: false, note: "", issues: [],
    } as never;
    render(<PuzzleCard puzzle={choice} />);
    expect(screen.getByText("Multiple choice")).toBeTruthy();
    const list = screen.getByRole("list", { name: "The answers" });
    expect(list.textContent).toContain("✓ Rome");
    expect(list.textContent).not.toContain("✓ Paris");
  });
});
