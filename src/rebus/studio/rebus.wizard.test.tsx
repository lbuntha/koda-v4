import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreatePanel } from "./CreatePanel";
import { StudioAPI } from "./studioApi";

vi.mock("./studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studioApi")>("./studioApi");
  return { ...actual, StudioAPI: { create: vi.fn() } };
});
const api = vi.mocked(StudioAPI);
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
const nextButton = () => screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;

beforeEach(() => {
  api.create.mockReset();
  render(<CreatePanel onChanged={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Write one myself/ }));
});

describe("the guided creator", () => {
  it("starts by asking what kind of question, and will not go on until one is picked", () => {
    expect(screen.getByRole("heading", { name: "What kind of question?" })).toBeTruthy();
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText("To continue: Pick a kind of question.")).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.textContent?.split(/(?=[A-Z][a-z])/)[0])).toHaveLength(4);
    fireEvent.click(screen.getByRole("radio", { name: /^Multiple choice/ }));
    expect(nextButton().disabled).toBe(false);
  });

  it("shows its three steps, and lets the author go back to one that is done", () => {
    fireEvent.click(screen.getByRole("radio", { name: /^Math/ }));
    next();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Build");
    fireEvent.click(screen.getByRole("button", { name: /Kind/ }));
    expect(screen.getByRole("heading", { name: "What kind of question?" })).toBeTruthy();
  });

  it("builds a multiple-choice question: Next says what is missing until the question, the answers and the right one are there", async () => {
    api.create.mockResolvedValue({ status: "draft", pieces: [{ kind: "word", text: "x" }] } as never);
    fireEvent.click(screen.getByRole("radio", { name: /^Multiple choice/ }));
    next();
    expect(nextButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("The question"), { target: { value: "What is the capital of France?" } });
    fireEvent.change(screen.getByLabelText("Answer 1"), { target: { value: "Paris" } });
    // Two answers that say the same thing are caught here, not after saving.
    fireEvent.change(screen.getByLabelText("Answer 2"), { target: { value: "paris" } });
    expect(screen.getByText(/To continue: Two answers say the same thing/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Answer 2"), { target: { value: "Rome" } });
    expect(screen.getByText(/To continue: Say why the pieces give that answer/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why it works"), { target: { value: "Paris is the capital of France." } });
    expect(nextButton().disabled).toBe(false);

    // Mark the second one right, and the answer follows.
    fireEvent.click(screen.getByRole("radio", { name: "Answer 2 is the right one" }));
    next();
    expect(screen.getByRole("group", { name: "Choose your answer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({ kind: "choice", answer: "Rome", choice: { options: ["Paris", "Rome"], correct: 1 }, approve: false });
  });

  it("offers a picture or photo to name without the words and signs of a full puzzle", () => {
    fireEvent.click(screen.getByRole("radio", { name: /^Name a picture/ }));
    next();
    expect(screen.getByRole("button", { name: "Add a photo" })).toBeTruthy();
    expect(screen.queryByLabelText("Word")).toBeNull();
    expect(screen.queryByRole("button", { name: "+" })).toBeNull();
  });

  it("keeps a full picture puzzle's words and signs", () => {
    fireEvent.click(screen.getByRole("radio", { name: /^Picture puzzle/ }));
    next();
    expect(screen.getByRole("button", { name: "+" })).toBeTruthy();
  });
});
