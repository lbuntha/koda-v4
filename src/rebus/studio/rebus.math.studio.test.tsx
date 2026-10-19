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

const open = () => {
  render(<CreatePanel onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Write a math question/ }));
};

describe("writing a math question", () => {
  it("shows the question and its answer as the child will meet them, worked out from the numbers", () => {
    open();
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

  it("says why numbers do not make a question, and will not let it be approved", () => {
    open();
    fireEvent.change(screen.getByLabelText("Sum"), { target: { value: "÷" } });
    fireEvent.change(screen.getByLabelText("Second number"), { target: { value: "4" } });
    expect(screen.getByRole("alert").textContent).toContain("division must come out even");
    expect((screen.getByRole("button", { name: /Save & approve/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the numbers, not a typed answer", async () => {
    api.create.mockResolvedValue({ status: "draft", pieces: [{ kind: "word", text: "6 × 7 = ?" }] } as never);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({ kind: "math", category: "math", math: { a: 6, op: "×", b: 7, unknown: "result" }, answer: "42", approve: false });
  });
});
