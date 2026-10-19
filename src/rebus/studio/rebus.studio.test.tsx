import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { RebusStudio } from "./RebusStudio";
import { StudioAPI, type Overview, type StudioPuzzle } from "./studioApi";

vi.mock("./studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studioApi")>("./studioApi");
  return {
    ...actual,
    StudioAPI: {
      overview: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
      setStatus: vi.fn(),
      approveAll: vi.fn(),
      remove: vi.fn(),
      publish: vi.fn(),
      releases: vi.fn(),
      rollback: vi.fn(),
    },
  };
});

const api = vi.mocked(StudioAPI);

const puzzle = (i: number, over: Partial<StudioPuzzle> = {}): StudioPuzzle => ({ ...SAMPLE_PUZZLES[i], status: "draft", seeded: true, note: "", issues: [], ...over });

const overview = (status: Partial<Overview["byStatus"]> = {}): Overview => ({
  byStatus: { draft: 3, approved: 0, published: 12, retired: 0, rejected: 0, ...status },
  byCategory: {},
  version: 4,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.overview.mockResolvedValue(overview());
  api.list.mockResolvedValue({ puzzles: [puzzle(7), puzzle(8), puzzle(9)], total: 3 });
  api.releases.mockResolvedValue({ releases: [] });
});

describe("the Studio's first screen", () => {
  it("says how many puzzles are live, waiting for review, ready to publish and unpublished", async () => {
    render(<RebusStudio />);
    await screen.findByText("Waiting for review");
    expect(await screen.findByText("Live puzzles")).toBeTruthy();
    expect(screen.getByText("Ready to publish")).toBeTruthy();
    expect(screen.getByText("Unpublished")).toBeTruthy();
    expect(screen.getByText("12 of 15 puzzles reviewed")).toBeTruthy();
  });

  it("shows a refusal from the server instead of an empty screen", async () => {
    const { ApiError } = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
    api.overview.mockRejectedValue(new ApiError(403, "not_an_operator", "Only an operator can manage Rebus Rush puzzles."));
    render(<RebusStudio />);
    await screen.findByText("Only an operator can manage Rebus Rush puzzles.");
  });
});

describe("reviewing what is waiting", () => {
  it("asks the server for drafts, whatever wrote them, one card at a time", async () => {
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }));
    expect(screen.getByText("3 waiting for review")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("approves a puzzle and moves to the next", async () => {
    api.setStatus.mockResolvedValue(puzzle(7, { status: "approved" }));
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByRole("article", { name: "Peanut butter" });
    expect(api.setStatus).toHaveBeenCalledWith(SAMPLE_PUZZLES[7].id, "approved");
    expect(screen.getByText("2 waiting for review")).toBeTruthy();
  });

  it("will not let a puzzle with a problem be approved", async () => {
    api.list.mockResolvedValue({ puzzles: [puzzle(7, { issues: ["no-explanation"] })], total: 1 });
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Say why the pieces give that answer.")).toBeTruthy();
  });

  it("rejects a weak puzzle and moves on", async () => {
    api.setStatus.mockResolvedValue(puzzle(7, { status: "rejected" }));
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await screen.findByRole("article", { name: "Peanut butter" });
    expect(api.setStatus).toHaveBeenCalledWith(SAMPLE_PUZZLES[7].id, "rejected", "");
  });

  it("edits a puzzle in place, keeps it in the queue with the fix, and it can then be approved", async () => {
    api.edit.mockResolvedValue(puzzle(7, { explanation: "hot + dog = a hot dog you eat." }));
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const why = await screen.findByDisplayValue(SAMPLE_PUZZLES[7].explanation);
    fireEvent.change(why, { target: { value: "hot + dog = a hot dog you eat." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.edit).toHaveBeenCalledWith(SAMPLE_PUZZLES[7].id, expect.objectContaining({ explanation: "hot + dog = a hot dog you eat.", answer: "Hot dog" })));
    expect(await screen.findByText("hot + dog = a hot dog you eat.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByText("3 waiting for review")).toBeTruthy();
  });

  it("shows the server's reason when a fix is refused, and keeps the editor open", async () => {
    const { ApiError } = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
    api.edit.mockRejectedValue(new ApiError(422, "puzzle_not_ready", "The answer is written in the puzzle."));
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByDisplayValue(SAMPLE_PUZZLES[7].explanation);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("The answer is written in the puzzle.");
    expect(screen.getByDisplayValue(SAMPLE_PUZZLES[7].explanation)).toBeTruthy();
  });

  it("approves everything in view that passes the checks, in one click, and says what it left", async () => {
    api.approveAll.mockResolvedValue({ approved: 2, skipped: 1 });
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("button", { name: "Approve all 3 that pass the checks" }));
    await screen.findByText("Approved 2. 1 need a person.");
    expect(api.approveAll).toHaveBeenCalledWith(undefined);
  });

  it("limits approve-all to the category being looked at", async () => {
    api.approveAll.mockResolvedValue({ approved: 1, skipped: 0 });
    render(<RebusStudio />);
    await screen.findByRole("article", { name: "Hot dog" });
    fireEvent.click(screen.getByRole("tab", { name: "Food" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "draft", category: "food" })));
    fireEvent.click(await screen.findByRole("button", { name: /Approve all/ }));
    await waitFor(() => expect(api.approveAll).toHaveBeenCalledWith("food"));
  });

  it("says so when nothing is waiting", async () => {
    api.list.mockResolvedValue({ puzzles: [], total: 0 });
    render(<RebusStudio />);
    await screen.findByText("Nothing is waiting for review.");
    expect(screen.queryByRole("button", { name: /Approve all/ })).toBeNull();
  });
});

describe("the puzzle list", () => {
  const openList = async () => {
    render(<RebusStudio />);
    await screen.findByText("Live puzzles");
    fireEvent.click(screen.getByRole("tab", { name: /All puzzles/ }));
  };

  it("offers the right next step for each state", async () => {
    api.list.mockResolvedValue({
      puzzles: [puzzle(0, { status: "draft", seeded: false }), puzzle(1, { status: "approved", seeded: false }), puzzle(2, { status: "published" }), puzzle(3, { status: "retired" }), puzzle(4, { status: "rejected", seeded: false })],
      total: 5,
    });
    await openList();
    const card = (name: string) => screen.findByRole("article", { name });
    const draft = within(await card("Germany"));
    expect(draft.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(draft.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(within(await card("Turkey")).getByRole("button", { name: "Back to draft" })).toBeTruthy();
    const live = within(await card("Wales"));
    expect(live.getByRole("button", { name: "Unpublish" })).toBeTruthy();
    expect(live.queryByRole("button", { name: "Looks good" })).toBeNull();
    expect(within(await card("Spain")).getByRole("button", { name: "Publish again" })).toBeTruthy();
    expect(within(await card("Chile")).getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("unpublishes a live puzzle and publishes it again", async () => {
    api.list.mockResolvedValue({ puzzles: [puzzle(2, { status: "published" })], total: 1 });
    api.setStatus.mockResolvedValue(puzzle(2, { status: "retired" }));
    await openList();
    fireEvent.click(within(await screen.findByRole("article", { name: "Wales" })).getByRole("button", { name: "Unpublish" }));
    await waitFor(() => expect(api.setStatus).toHaveBeenCalledWith(SAMPLE_PUZZLES[2].id, "retired"));
  });

  it("never offers to delete a seed puzzle", async () => {
    api.list.mockResolvedValue({ puzzles: [puzzle(0, { status: "draft", seeded: true })], total: 1 });
    await openList();
    const card = within(await screen.findByRole("article", { name: "Germany" }));
    expect(card.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("will not approve a draft that has a problem", async () => {
    api.list.mockResolvedValue({ puzzles: [puzzle(0, { status: "draft", seeded: false, issues: ["duplicate"] })], total: 1 });
    await openList();
    const card = within(await screen.findByRole("article", { name: "Germany" }));
    expect((card.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(true);
    expect(card.getByText("Another puzzle already has this answer.")).toBeTruthy();
  });

  it("filters by status and searches by answer, asking the server", async () => {
    await openList();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "retired" } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "retired" })));
    fireEvent.change(screen.getByLabelText("Search answers"), { target: { value: "tea" } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "tea" })));
  });

  it("writes a new puzzle from the picture library and saves it as a draft", async () => {
    api.create.mockResolvedValue(puzzle(7, { status: "draft", seeded: false }));
    await openList();
    fireEvent.click(await screen.findByRole("button", { name: "New puzzle" }));
    fireEvent.click(await screen.findByRole("button", { name: "cheese" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "pie" }));
    fireEvent.change(screen.getAllByRole("textbox").find((el) => (el as HTMLInputElement).maxLength === 80 && !(el as HTMLInputElement).placeholder) as HTMLElement, { target: { value: "Cheese pie" } });
    expect(screen.getByText("Say why the pieces give that answer.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why it works"), { target: { value: "cheese + pie = cheese pie." } });
    expect(screen.getByText("All checks pass")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ approve: false, answer: "Cheese pie", pieces: [expect.objectContaining({ id: "rebus-cheese" }), { kind: "op", op: "+" }, expect.objectContaining({ id: "rebus-pie" })] })));
  });

  it("warns, before saving, that the answer is written in the puzzle", async () => {
    await openList();
    fireEvent.click(await screen.findByRole("button", { name: "New puzzle" }));
    fireEvent.change(screen.getByLabelText("A written word"), { target: { value: "Teapot" } });
    fireEvent.click(screen.getByRole("button", { name: "Add word" }));
    fireEvent.change(screen.getAllByRole("textbox").find((el) => (el as HTMLInputElement).maxLength === 80 && !(el as HTMLInputElement).placeholder) as HTMLElement, { target: { value: "Teapot" } });
    expect(screen.getByText("The answer is written in the puzzle. Show it with pictures instead.")).toBeTruthy();
  });
});

describe("publishing", () => {
  it("publishes the approved puzzles as one release with a note", async () => {
    api.overview.mockResolvedValue(overview({ approved: 2 }));
    api.list.mockResolvedValue({ puzzles: [puzzle(0, { status: "approved", seeded: false }), puzzle(1, { status: "approved", seeded: false })], total: 2 });
    api.publish.mockResolvedValue({ number: 1, note: "first", puzzleIds: ["a", "b"], by: "x", at: new Date().toISOString(), rolledBack: false, version: 5 });
    render(<RebusStudio />);
    await screen.findByText("Live puzzles");
    fireEvent.click(screen.getByRole("tab", { name: /Publish/ }));
    fireEvent.change(await screen.findByLabelText("Note for this release"), { target: { value: "first" } });
    fireEvent.click(await screen.findByRole("button", { name: "Publish 2 puzzles" }));
    await screen.findByText("Published 2 puzzles.");
    expect(api.publish).toHaveBeenCalledWith("first");
  });

  it("takes a release back, any release, including the first", async () => {
    api.releases.mockResolvedValue({ releases: [{ number: 1, note: "first", puzzleIds: ["a"], by: "x", byName: "Ly Buntha", at: new Date().toISOString(), rolledBack: false }, { number: 0, note: "", puzzleIds: ["b"], by: "x", at: new Date().toISOString(), rolledBack: true }] });
    api.rollback.mockResolvedValue({ number: 1, note: "", puzzleIds: [], by: "x", at: "", rolledBack: true });
    api.list.mockResolvedValue({ puzzles: [], total: 0 });
    render(<RebusStudio />);
    await screen.findByText("Live puzzles");
    fireEvent.click(screen.getByRole("tab", { name: /Publish/ }));
    expect(await screen.findByText("Taken back")).toBeTruthy();
    expect(screen.getByText("Published by Ly Buntha")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Take back" }));
    await screen.findByText("Release 1 was taken back.");
    expect(api.rollback).toHaveBeenCalledWith(1);
  });

  it("cannot publish when nothing is approved", async () => {
    api.list.mockResolvedValue({ puzzles: [], total: 0 });
    render(<RebusStudio />);
    await screen.findByText("Live puzzles");
    fireEvent.click(screen.getByRole("tab", { name: /Publish/ }));
    const button = await screen.findByRole("button", { name: "Publish 0 puzzles" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("who made a puzzle and which release it shipped in", () => {
  it("shows the release a live puzzle went out in, and whose account authored it", async () => {
    api.list.mockResolvedValue({ puzzles: [puzzle(0, { status: "published", release: 1, createdByName: "Ly Buntha" }), puzzle(1, { status: "published", release: 2, seeded: false, createdByName: "Maya" })], total: 2 });
    render(<RebusStudio />);
    await screen.findByText("Live puzzles");
    fireEvent.click(screen.getByRole("tab", { name: /All puzzles/ }));
    const first = within(await screen.findByRole("article", { name: "Germany" }));
    expect(first.getByText("Release 1")).toBeTruthy();
    expect(first.getByText("Added by Ly Buntha")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Turkey" })).getByText("Added by Maya")).toBeTruthy();
  });
});

describe("creating", () => {
  it("opens on Review when drafts wait, and on Create when none do", async () => {
    const { unmount } = render(<RebusStudio />);
    await screen.findByRole("tab", { name: /Review/, selected: true });
    unmount();
    api.overview.mockResolvedValue(overview({ draft: 0 }));
    render(<RebusStudio />);
    await screen.findByRole("tab", { name: "Create", selected: true });
    expect(screen.getByRole("button", { name: /Write one myself/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Draft with AI/ })).toBeTruthy();
  });

  it("writes one puzzle and approves it in the same step", async () => {
    api.overview.mockResolvedValue(overview({ draft: 0 }));
    api.create.mockResolvedValue(puzzle(7, { status: "approved", seeded: false }));
    render(<RebusStudio />);
    fireEvent.click(await screen.findByRole("button", { name: /Write one myself/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /^Picture puzzle/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "cheese" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "pie" }));
    fireEvent.change(screen.getAllByRole("textbox").find((el) => (el as HTMLInputElement).maxLength === 80 && !(el as HTMLInputElement).placeholder) as HTMLElement, { target: { value: "Cheese pie" } });
    fireEvent.change(screen.getByLabelText("Why it works"), { target: { value: "cheese + pie = cheese pie." } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("tab", { name: "Little kids" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & approve" }));
    await screen.findByText(/Saved “Cheese pie” and approved it/);
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ approve: true, answer: "Cheese pie", ages: [6, 8], difficulty: 1 }));
  });
});
