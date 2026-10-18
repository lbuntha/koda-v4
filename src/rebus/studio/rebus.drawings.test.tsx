import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtStore } from "../../lib/sync/artStore";
import { deleteSvgAsset, listSvgAssets } from "../../lib/svgAssetsApi";
import { bundledSvg } from "../icons/useRebusIcons";
import { ICON_ART } from "../icons/library";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { DrawingsPanel } from "./DrawingsPanel";
import { StudioAPI, type StudioPuzzle } from "./studioApi";

vi.mock("../../lib/svgAssetsApi", async () => {
  const actual = await vi.importActual<typeof import("../../lib/svgAssetsApi")>("../../lib/svgAssetsApi");
  return { ...actual, listSvgAssets: vi.fn(async () => []), deleteSvgAsset: vi.fn(async () => undefined) };
});

vi.mock("./studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studioApi")>("./studioApi");
  return { ...actual, StudioAPI: { iconUsage: vi.fn(), list: vi.fn() } };
});

const puzzle = (i: number): StudioPuzzle => ({ ...SAMPLE_PUZZLES[i], status: "published", seeded: true, note: "", issues: [] });

/** The Art page's editor, stood in for: what matters is what Rebus hands it and does with what it returns. */
vi.mock("../../components/SvgAssetEditorModal", () => ({
  SvgAssetEditorModal: (p: { editingId: string | null; initialId?: string; initialMarkup?: string; initialCategory?: string; onClose(): void; onSaved(id: string, markup: string, category: string): void }) => (
    <div role="dialog" aria-label="editor" data-editing={p.editingId ?? ""} data-id={p.initialId ?? ""} data-category={p.initialCategory ?? ""}>
      <pre>{p.initialMarkup}</pre>
      <button onClick={() => p.onSaved(p.initialId ?? "rebus-new", "<svg/>", "rebus")}>save</button>
      <button onClick={p.onClose}>close</button>
    </div>
  ),
}));

const art = (id: string) => ({ id, category: "rebus", markup: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/></svg>', rev: 1, modified: 1 });

beforeEach(async () => {
  vi.mocked(StudioAPI.iconUsage).mockReset();
  vi.mocked(StudioAPI.list).mockReset();
  vi.mocked(StudioAPI.iconUsage).mockResolvedValue({ usage: { "rebus-honey": { count: 3, answers: ["Honeymoon", "Honeybee", "Honey jar"] }, "rebus-moon": { count: 1, answers: ["Honeymoon"] } } });
  vi.mocked(StudioAPI.list).mockResolvedValue({ puzzles: [puzzle(6), puzzle(5)], total: 2 });
  vi.mocked(listSvgAssets).mockClear();
  vi.mocked(deleteSvgAsset).mockClear();
  await ArtStore.load();
  for (const id of ["rebus-honey", "rebus-yeti"]) await ArtStore.remove(id);
});

const card = (name: string) => within(screen.getByRole("article", { name }));

describe("the Drawings tab", () => {
  it("shows every drawing, built in unless the Art library has changed it", () => {
    render(<DrawingsPanel />);
    expect(screen.getAllByRole("article")).toHaveLength(Object.keys(ICON_ART).length);
    expect(card("honey").getByText("Built in")).toBeTruthy();
  });

  it("opens the Art page's editor on the built-in drawing, filed under Rebus, as a new override", () => {
    render(<DrawingsPanel />);
    fireEvent.click(card("honey").getByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "editor" });
    expect(dialog.getAttribute("data-id")).toBe("rebus-honey");
    expect(dialog.getAttribute("data-editing")).toBe("");
    expect(dialog.getAttribute("data-category")).toBe("rebus");
    expect(within(dialog).getByText(bundledSvg("honey")!)).toBeTruthy();
  });

  it("opens an already-edited drawing as an edit of that Art asset, and offers the way back to the built-in one", async () => {
    await ArtStore.put(art("rebus-honey"));
    render(<DrawingsPanel />);
    expect(card("honey").getByText("Edited")).toBeTruthy();
    fireEvent.click(card("honey").getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "editor" }).getAttribute("data-editing")).toBe("rebus-honey");
  });

  it("saves, tells the admin the puzzles changed, and refreshes the art library", async () => {
    render(<DrawingsPanel />);
    fireEvent.click(card("honey").getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Saved the drawing honey. Puzzles using it change now.");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(listSvgAssets).toHaveBeenCalled();
  });

  it("starts a new drawing under the Rebus prefix", () => {
    render(<DrawingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "New drawing" }));
    expect(screen.getByRole("dialog", { name: "editor" }).getAttribute("data-id")).toBe("rebus-");
  });

  it("goes back to the built-in drawing by removing the Art library's version", async () => {
    await ArtStore.put(art("rebus-honey"));
    render(<DrawingsPanel />);
    fireEvent.click(card("honey").getByRole("button", { name: "Use built-in" }));
    await screen.findByText("honey is back to the built-in drawing.");
    expect(deleteSvgAsset).toHaveBeenCalledWith("rebus-honey");
    await act(async () => undefined);
    expect(card("honey").getByText("Built in")).toBeTruthy();
  });

  it("lists a drawing that exists only in the Art library as Added, and deletes rather than resets it", async () => {
    await ArtStore.put(art("rebus-yeti"));
    render(<DrawingsPanel />);
    expect(card("yeti").getByText("Added")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Added/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(card("yeti").getByRole("button", { name: "Delete" }));
    await screen.findByText("The drawing yeti was deleted.");
    expect(deleteSvgAsset).toHaveBeenCalledWith("rebus-yeti");
  });

  it("filters to the drawings that have been changed, and by name", async () => {
    await ArtStore.put(art("rebus-honey"));
    render(<DrawingsPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /Edited/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: /^All/ }));
    fireEvent.change(screen.getByLabelText("Search the pictures"), { target: { value: "moo" } });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["moon"]);
  });
});


describe("which puzzles use a drawing", () => {
  it("says on each card how many puzzles use it, in the right grammar, or that none do yet", async () => {
    render(<DrawingsPanel />);
    expect(await within(screen.getByRole("article", { name: "honey" })).findByText("Used in 3 puzzles")).toBeTruthy();
    expect(card("moon").getByText("Used in 1 puzzle")).toBeTruthy();
    expect(card("apple").getByText("Not used yet")).toBeTruthy();
  });

  it("opens the puzzles that use it, drawn as a child sees them, asking the server for just that drawing", async () => {
    render(<DrawingsPanel />);
    fireEvent.click(await within(screen.getByRole("article", { name: "honey" })).findByRole("button", { name: "See the puzzles that use honey" }));
    expect(await screen.findByRole("heading", { name: "Puzzles using honey" })).toBeTruthy();
    expect(StudioAPI.list).toHaveBeenCalledWith({ icon: "rebus-honey", limit: 100 });
    expect(await screen.findByRole("article", { name: "Honeymoon" })).toBeTruthy();
    expect(screen.getByText("2 puzzles use this drawing. A change to it changes all of them.")).toBeTruthy();
  });

  it("lets the drawing be edited from there, and comes back to the list", async () => {
    render(<DrawingsPanel />);
    fireEvent.click(await within(screen.getByRole("article", { name: "honey" })).findByRole("button", { name: "See the puzzles that use honey" }));
    await screen.findByRole("heading", { name: "Puzzles using honey" });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "editor" }).getAttribute("data-id")).toBe("rebus-honey");
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    fireEvent.click(screen.getByRole("button", { name: "All drawings" }));
    expect(screen.getAllByRole("article").length).toBeGreaterThan(50);
  });

  it("says so when no puzzle uses the drawing", async () => {
    vi.mocked(StudioAPI.list).mockResolvedValue({ puzzles: [], total: 0 });
    render(<DrawingsPanel />);
    fireEvent.click(within(screen.getByRole("article", { name: "apple" })).getByRole("button", { name: "See the puzzles that use apple" }));
    await screen.findByText("No puzzle uses this drawing yet.");
  });

  it("refreshes the counts after a drawing is saved, and shows what the server refuses", async () => {
    render(<DrawingsPanel />);
    await within(screen.getByRole("article", { name: "honey" })).findByText("Used in 3 puzzles");
    fireEvent.click(card("honey").getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await screen.findByText("Saved the drawing honey. Puzzles using it change now.");
    expect(StudioAPI.iconUsage).toHaveBeenCalledTimes(2);
    const { ApiError } = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
    vi.mocked(StudioAPI.list).mockRejectedValue(new ApiError(403, "no", "Only an operator can manage Rebus Rush puzzles."));
    fireEvent.click(within(screen.getByRole("article", { name: "apple" })).getByRole("button", { name: "See the puzzles that use apple" }));
    await screen.findByText("Only an operator can manage Rebus Rush puzzles.");
  });
});
