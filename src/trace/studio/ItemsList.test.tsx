import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioCollection } from "../data/api";

const api = vi.hoisted(() => ({
  fetchStudioCollections: vi.fn<() => Promise<StudioCollection[]>>(),
  saveStudioCollection: vi.fn(async (c: StudioCollection) => c),
  deleteStudioItem: vi.fn(async () => undefined),
  saveStudioItem: vi.fn(async () => ({})),
  fetchStudioItems: vi.fn(async () => []),
}));
vi.mock("../data/api", () => api);

import { GOLDEN_ITEMS } from "../fixtures/items";
import { TraceDrafts, newDraft } from "./drafts";
import { ItemsList } from "./ItemsList";

const collection = (over: Partial<StudioCollection>): StudioCollection => ({
  id: "c1", title: "Set", description: "", language: "km", itemIds: [], order: 100, cover: null,
  rev: 1, publishedRev: null, publishedAt: null, updatedAt: new Date().toISOString(), changed: false, ...over,
});

const seed = (n: number) => {
  for (let i = 0; i < n; i++) TraceDrafts.save(newDraft({ ...structuredClone(GOLDEN_ITEMS[0]), id: `t-${i}`, title: `Item ${i}` }));
};

const show = () => render(<ItemsList kinds={["letter", "line"]} onOpen={vi.fn()} onCreate={vi.fn()} />);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.fetchStudioCollections.mockResolvedValue([]);
});

describe("Trace items list", () => {
  it("draws one page of a large set, and pages through it", async () => {
    seed(30);
    show();
    expect(screen.getByText("30 items")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(24);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
  });

  it("finds unused items, and asks before deleting one from its collection", async () => {
    seed(2);
    api.fetchStudioCollections.mockResolvedValue([collection({ itemIds: ["t-0"], cover: "t-0" })]);
    show();
    await screen.findByText(/in 1 collection/);
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "unused" } });
    expect(screen.getByText("1 item")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "" } });

    const card = screen.getByRole("checkbox", { name: "Select Item 0" }).closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/will be taken out of it/)).toBeTruthy();
    expect(api.deleteStudioItem).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!); });
    expect(api.deleteStudioItem).toHaveBeenCalledWith("t-0");
    await waitFor(() => expect(api.saveStudioCollection).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", itemIds: [], cover: null })));
    expect(TraceDrafts.get("t-0")).toBeUndefined();
  });
});
