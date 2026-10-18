import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedPuzzle } from "../generate/pipeline";
import { DEFAULT_SYSTEM_PROMPT } from "../generate/prompt";
import { GeneratePanel, worthSaving } from "./GeneratePanel";
import { generatePuzzles, StudioAPI } from "./studioApi";

vi.mock("./studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studioApi")>("./studioApi");
  return { ...actual, generatePuzzles: vi.fn(), StudioAPI: { prompts: vi.fn(), savePrompt: vi.fn(), create: vi.fn() } };
});

const generate = vi.mocked(generatePuzzles);
const api = vi.mocked(StudioAPI);

const candidate = (answer: string, a: string, b: string, checks: Partial<GeneratedPuzzle["checks"]> = {}): GeneratedPuzzle => ({
  draft: {
    category: "food", ages: [6, 12], difficulty: 1, trick: "compound", answer, accepts: [], explanation: `${a} + ${b} = ${answer.toLowerCase()}.`,
    pieces: [{ kind: "icon", id: `rebus-${a}`, name: a }, { kind: "op", op: "+" }, { kind: "icon", id: `rebus-${b}`, name: b }],
  },
  missingIcons: [],
  checks: { issues: [], blind: { ok: true, said: answer.toLowerCase() }, safe: true, ...checks },
});

const response = (puzzles: GeneratedPuzzle[]) => ({
  puzzles,
  provider: "claude",
  model: "claude-sonnet-5-5",
  stats: { drafted: puzzles.length, valid: puzzles.length, solved: puzzles.filter((p) => p.checks.blind?.ok).length, duplicates: puzzles.filter((p) => p.checks.issues.includes("duplicate")).length, needIcons: puzzles.filter((p) => p.checks.issues.includes("unknown-icon")).length, unsafe: puzzles.filter((p) => !p.checks.safe).length },
});

beforeEach(() => {
  generate.mockReset();
  Object.values(api).forEach((fn) => fn.mockReset());
  api.prompts.mockResolvedValue({ versions: [], latest: null });
});

describe("what is worth saving", () => {
  it("leaves out repeats, unsafe puzzles and ones that need a drawing that does not exist, and keeps a puzzle the solver misread for a person to judge", () => {
    expect(worthSaving(candidate("Honeymoon", "honey", "moon"))).toBe(true);
    expect(worthSaving(candidate("Honeymoon", "honey", "moon", { issues: ["duplicate"] }))).toBe(false);
    expect(worthSaving(candidate("Honeymoon", "honey", "moon", { safe: false }))).toBe(false);
    expect(worthSaving(candidate("Yeti pie", "yeti", "pie", { issues: ["unknown-icon"] }))).toBe(false);
    expect(worthSaving(candidate("Honeymoon", "honey", "moon", { blind: { ok: false, said: "sweet night" } }))).toBe(true);
  });
});

describe("the Generate tab", () => {
  it("sends the brief as chosen and shows the drafts with the checks they got", async () => {
    generate.mockResolvedValue(response([candidate("Honeymoon", "honey", "moon"), candidate("Hot dog", "fire", "dog", { blind: { ok: false, said: "fire dog" } })]));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await screen.findByRole("article", { name: "Honeymoon" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ brief: { category: "food", ages: [9, 12], difficulty: 2, count: 10, tricks: ["compound"], notes: "" }, model: "sonnet" }));
    expect(screen.getByText("2 drafted")).toBeTruthy();
    expect(screen.getByText("1 solved by the blind check")).toBeTruthy();
    expect(screen.getByText("A solver who saw only the pictures read it as “honeymoon”.")).toBeTruthy();
    expect(screen.getByText("A solver who saw only the pictures read it as “fire dog”, not the answer.")).toBeTruthy();
    expect(screen.getByText("Made by claude-sonnet-5-5")).toBeTruthy();
  });

  it("changes the count, the tricks and the notes in the request", async () => {
    generate.mockResolvedValue(response([]));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "20" }));
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("button", { name: "Sounds like" }));
    fireEvent.change(screen.getByLabelText("Extra notes for the model"), { target: { value: "breakfast foods" } });
    fireEvent.click(screen.getByRole("button", { name: "Draft 20 puzzles" }));
    await waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0][0].brief).toMatchObject({ count: 20, tricks: ["compound", "sound-alike"], notes: "breakfast foods" });
  });

  it("saves only the keepers, as AI drafts carrying their checks, and says how many", async () => {
    const good = candidate("Honeymoon", "honey", "moon");
    generate.mockResolvedValue(response([good, candidate("Hot dog", "fire", "dog", { issues: ["duplicate"] }), candidate("Beer belly", "apple", "cake", { safe: false })]));
    api.create.mockResolvedValue({} as never);
    const saved = vi.fn();
    render(<GeneratePanel onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add 1 to review" }));
    await screen.findByText("Saved 1 drafts. Review them in All puzzles.");
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ answer: "Honeymoon", source: "ai", checks: good.checks, model: "claude-sonnet-5-5", promptVersion: 0, approve: false }));
    expect(saved).toHaveBeenCalled();
  });

  it("names the drawings the model wished for, so an artist can be asked", async () => {
    generate.mockResolvedValue(response([{ ...candidate("Yeti pie", "yeti", "pie", { issues: ["unknown-icon"] }), missingIcons: ["yeti"] }]));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await screen.findByText("These ideas need drawings that do not exist yet: yeti.");
    expect(screen.getByText("1 need a drawing")).toBeTruthy();
  });

  it("shows the server's reason when there is no key or the feature is off", async () => {
    generate.mockRejectedValue(new Error("No Claude API key is configured. Add one in Admin → API keys."));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await screen.findByText("No Claude API key is configured. Add one in Admin → API keys.");
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("stops and says how far it got when saving fails part-way", async () => {
    generate.mockResolvedValue(response([candidate("Honeymoon", "honey", "moon"), candidate("Hot dog", "fire", "dog")]));
    api.create.mockResolvedValueOnce({} as never).mockRejectedValueOnce(new Error("boom"));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add 2 to review" }));
    await screen.findByText(/1 were saved before it stopped/);
  });
});

describe("the prompt", () => {
  it("starts on the built-in prompt, sends nothing special for it, and sends an edited one", async () => {
    generate.mockResolvedValue(response([]));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByText("Built-in prompt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    expect(generate.mock.calls[0][0].systemPrompt).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Show the prompt" }));
    const box = screen.getByLabelText("System prompt") as HTMLTextAreaElement;
    expect(box.value).toBe(DEFAULT_SYSTEM_PROMPT);
    fireEvent.change(box, { target: { value: DEFAULT_SYSTEM_PROMPT + "\n8. Prefer Cambodian foods." } });
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(generate.mock.calls[1][0].systemPrompt).toContain("Prefer Cambodian foods");
  });

  it("saves an edit as the next numbered version and uses the latest saved one when it opens", async () => {
    api.prompts.mockResolvedValue({ versions: [{ version: 2, text: "SECOND PROMPT. ".repeat(4), by: "x", at: "" }, { version: 1, text: "first", by: "x", at: "" }], latest: { version: 2, text: "SECOND PROMPT. ".repeat(4), by: "x", at: "" } });
    api.savePrompt.mockResolvedValue({ version: 3, text: "t", by: "x", at: "" });
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    await screen.findByText("Prompt version 2");
    fireEvent.click(screen.getByRole("button", { name: "Show the prompt" }));
    expect((screen.getByLabelText("System prompt") as HTMLTextAreaElement).value).toContain("SECOND PROMPT.");
    fireEvent.click(screen.getByRole("button", { name: "Save as version 3" }));
    await screen.findByText("Prompt version 3");
    expect(api.savePrompt).toHaveBeenCalled();
  });
});

describe("choosing what to keep", () => {
  it("approves the ticked puzzles now, and leaves out one that was unticked", async () => {
    generate.mockResolvedValue(response([candidate("Honeymoon", "honey", "moon"), candidate("Hot dog", "fire", "dog")]));
    api.create.mockResolvedValue({} as never);
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await screen.findByRole("article", { name: "Honeymoon" });
    fireEvent.click(screen.getAllByRole("button", { name: "Keeping" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Approve 1 now" }));
    await screen.findByText("Approved 1 puzzles. They go live in the next release.");
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ answer: "Honeymoon", approve: true }));
  });

  it("picks a level that sets the ages and difficulty together", async () => {
    generate.mockResolvedValue(response([]));
    render(<GeneratePanel onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: "Teens" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft 10 puzzles" }));
    await waitFor(() => expect(generate).toHaveBeenCalled());
    expect(generate.mock.calls[0][0].brief).toMatchObject({ ages: [13, 18], difficulty: 3 });
  });
});
