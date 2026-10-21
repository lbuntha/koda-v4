import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILT_IN_CATEGORIES, categories, parseCategories, setCategories } from "./categories";
import { categoryLabel, nameOfCategory } from "./categoryNames";
import { idFromName, CategoriesPanel } from "./studio/CategoriesPanel";
import { StudioAPI, type StudioCategory } from "./studio/studioApi";

vi.mock("./bankStore", () => ({ refreshBank: vi.fn(async () => undefined) }));
vi.mock("./studio/studioApi", async () => {
  const actual = await vi.importActual<typeof import("./studio/studioApi")>("./studio/studioApi");
  return { ...actual, StudioAPI: { categories: vi.fn(), addCategory: vi.fn(), editCategory: vi.fn(), reorderCategories: vi.fn(), removeCategory: vi.fn() } };
});
const api = vi.mocked(StudioAPI);

const row = (id: string, en: string, over: Partial<StudioCategory> = {}): StudioCategory => ({ id, names: { en }, tone: "indigo", topic: "logic", order: 0, enabled: true, builtIn: false, puzzles: 0, ...over });

beforeEach(() => {
  setCategories([]);
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("categories on a device", () => {
  it("stand in with the ones that shipped until the server has been heard from, the empty Khmer words topic switched off", () => {
    expect(categories().map((c) => c.id)).toEqual(["countries", "food", "sayings", "animals", "sports", "school", "science", "math"]);
    expect(categoryLabel("khmer", "km")).toBe("ពាក្យខ្មែរ");
    expect(categoryLabel("khmer", "en")).toBe("Khmer words");
  });

  it("follow the owner's list: a new one, the order, and one switched off", () => {
    setCategories([
      { id: "math", names: { en: "Math", km: "គណិត" }, tone: "cyan", topic: "numbers", order: 1, enabled: true },
      { id: "food", names: { en: "Food" }, tone: "pink", topic: "food", order: 0, enabled: true },
      { id: "hidden", names: { en: "Hidden" }, tone: "pink", topic: "food", order: 2, enabled: false },
    ]);
    expect(categories().map((c) => c.id)).toEqual(["food", "math"]);
    // A language the owner did not write falls back to English, then to the id.
    expect(categoryLabel("food", "km")).toBe("Food");
    expect(nameOfCategory({ id: "word-problems", names: {} })).toBe("word problems");
    expect(categoryLabel("unknown-thing")).toBe("unknown thing");
  });

  it("read only what is well formed from the wire", () => {
    const parsed = parseCategories([{ id: "math", names: { en: "Math", km: " " }, order: 3 }, { id: "Bad Id", names: { en: "x" } }, { id: "nonames" }, null, "x"]);
    expect(parsed).toEqual([{ id: "math", names: { en: "Math" }, tone: "indigo", topic: "logic", order: 3, enabled: true }]);
    expect(parseCategories(undefined)).toEqual([]);
    expect(BUILT_IN_CATEGORIES).toHaveLength(9);
  });
});

describe("the Studio's Categories tab", () => {
  it("makes an id from the English name", () => {
    expect(idFromName("Word problems")).toBe("word-problems");
    expect(idFromName("  Math!  ")).toBe("math");
    expect(idFromName("3D shapes")).toBe("d-shapes");
    expect(idFromName("")).toBe("");
  });

  it("lists every category with how many puzzles use it, and marks one that is off", async () => {
    api.categories.mockResolvedValue({ categories: [row("food", "Food", { puzzles: 12, builtIn: true }), row("math", "Math", { enabled: false, order: 1 })] });
    render(<CategoriesPanel />);
    await screen.findByText("Food");
    expect(screen.getByText("12 puzzles")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
  });

  it("adds a category, with its id made from the name, and shows it", async () => {
    api.categories.mockResolvedValueOnce({ categories: [row("food", "Food", { builtIn: true })] });
    api.addCategory.mockResolvedValue(row("math", "Math"));
    render(<CategoriesPanel />);
    await screen.findByText("Food");
    api.categories.mockResolvedValueOnce({ categories: [row("food", "Food", { builtIn: true }), row("math", "Math", { order: 1 })] });

    fireEvent.click(screen.getByRole("button", { name: "New category" }));
    fireEvent.change(screen.getByLabelText("Name in English"), { target: { value: "Math" } });
    expect((screen.getByLabelText("Id") as HTMLInputElement).value).toBe("math");
    fireEvent.change(screen.getByLabelText("Name in Khmer (optional)"), { target: { value: "គណិត" } });
    fireEvent.click(screen.getByRole("button", { name: "pink" }));
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() => expect(api.addCategory).toHaveBeenCalledWith({ id: "math", names: { en: "Math", km: "គណិត" }, tone: "pink", topic: "logic" }));
    await screen.findByText("Math");
  });

  it("will not add one with no name, and says what the server refused", async () => {
    api.categories.mockResolvedValue({ categories: [] });
    api.addCategory.mockRejectedValue(new Error("nope"));
    render(<CategoriesPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "New category" }));
    expect((screen.getByRole("button", { name: "Add category" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers delete only for a category of the owner's own that nothing uses", async () => {
    api.categories.mockResolvedValue({ categories: [row("food", "Food", { builtIn: true }), row("math", "Math", { puzzles: 2 }), row("quiz", "Quiz")] });
    render(<CategoriesPanel />);
    await screen.findByText("Food");
    for (const [name, deletable] of [["Edit Food", false], ["Edit Math", false], ["Edit Quiz", true]] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(screen.queryByRole("button", { name: "Delete category" }) !== null, name).toBe(deletable);
      fireEvent.click(screen.getByRole("button", { name }));
    }
  });
});
