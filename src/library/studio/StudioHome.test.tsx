import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookSummary, StudioMeta, StudioPage, StudioQuery } from "../api";

/**
 * The studio list is driven by the server: what is checked here is what the
 * page *asks for* — search, filters, sort, page — and that it draws what comes
 * back, including the empty and failed cases. The server's own tests check the
 * answers.
 */

const fetchStudioBooks = vi.hoisted(() => vi.fn<(q: StudioQuery, signal?: AbortSignal) => Promise<StudioPage>>());
vi.mock("../api", () => ({ fetchStudioBooks }));
vi.mock("../../assets/svg", () => ({ SvgAsset: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>, SvgMarkup: () => null }));

import { StudioHome } from "./StudioHome";

const META: StudioMeta = { categories: ["Food"], sorts: ["updated", "title"], statuses: ["draft", "published", "changed", "reported"], pageSizeMin: 5, pageSizeMax: 100 };

const book = (i: number, over: Partial<BookSummary> = {}): BookSummary => ({
  id: `book-${i}`, rev: 0, title: `Book ${i}`, language: "en", band: "A", category: "Food", picture: "book",
  status: "draft", changed: false, reports: 0, sentences: 4, questions: 7, updatedAt: new Date().toISOString(), ...over,
});

const pageOf = (books: BookSummary[], over: Partial<StudioPage> = {}): StudioPage => ({
  books, page: 1, pageSize: 25, total: books.length, pages: 1,
  stats: { all: 40, draft: 30, published: 10, changed: 2, reported: 1 },
  facets: { languages: [{ value: "en", count: 38 }, { value: "km", count: 2 }], bands: [{ value: "A", count: 40 }], categories: [{ value: "Food", count: 40 }] },
  ...over,
});

const last = () => fetchStudioBooks.mock.calls.at(-1)![0];

beforeEach(() => {
  localStorage.clear();
  fetchStudioBooks.mockReset();
  fetchStudioBooks.mockResolvedValue(pageOf([book(1), book(2, { status: "published", rev: 3, changed: true, reports: 2 })], { total: 40, pages: 2 }));
});

const renderHome = (props: Partial<Parameters<typeof StudioHome>[0]> = {}) =>
  render(<StudioHome meta={META} onOpen={vi.fn()} onNew={vi.fn()} onSoundNames={vi.fn()} {...props} />);

describe("the studio list", () => {
  it("shows a page of books with their status, and counts in the tabs", async () => {
    renderHome();
    expect(await screen.findByRole("button", { name: "Book 1" })).toBeTruthy();
    const row = screen.getByRole("button", { name: "Book 2" }).closest("tr")!;
    expect(row.textContent).toContain("Published · rev 3");
    expect(row.textContent).toContain("Unpublished changes");
    expect(row.textContent).toContain("⚑ 2 reports");
    expect(screen.getByRole("tab", { name: /Drafts/ }).textContent).toContain("30");
    expect(screen.getByText("40 books · page 1 of 2")).toBeTruthy();
    expect(last()).toMatchObject({ page: 1, pageSize: 25, sort: "updated", status: "" });
  });

  it("asks the server to search, once the typing stops", async () => {
    renderHome();
    await screen.findByRole("button", { name: "Book 1" });
    const calls = fetchStudioBooks.mock.calls.length;
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "ra" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "rain" } });
    await waitFor(() => expect(last().q).toBe("rain"));
    expect(fetchStudioBooks.mock.calls.length).toBe(calls + 1); // one request, not one per keystroke
  });

  it("offers only the options the books have, and filters, sorts and pages on the server", async () => {
    renderHome();
    await screen.findByRole("button", { name: "Book 1" });
    const language = screen.getByRole("combobox", { name: "Language" });
    expect([...language.querySelectorAll("option")].map((o) => o.value)).toEqual(["", "en", "km"]);
    fireEvent.change(language, { target: { value: "km" } });
    await waitFor(() => expect(last()).toMatchObject({ language: "km", page: 1 }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "title" } });
    await waitFor(() => expect(last().sort).toBe("title"));
    fireEvent.click(screen.getByRole("tab", { name: /Unpublished changes/ }));
    await waitFor(() => expect(last().status).toBe("changed"));
    fireEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(last().page).toBe(2));
  });

  it("remembers the view on this device, but not the search", async () => {
    const { unmount } = renderHome();
    await screen.findByRole("button", { name: "Book 1" });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), { target: { value: "title" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "rain" } });
    unmount();
    renderHome();
    await waitFor(() => expect(last()).toMatchObject({ sort: "title", q: "" }));
  });

  it("opens a book from its title, its row or its Edit button", async () => {
    const onOpen = vi.fn();
    renderHome({ onOpen });
    fireEvent.click(await screen.findByRole("button", { name: "Book 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Book 2" }));
    expect(onOpen.mock.calls.map(([b]) => b.id)).toEqual(["book-1", "book-2"]);
  });

  it("tells an empty search from an empty studio", async () => {
    fetchStudioBooks.mockResolvedValue(pageOf([], { total: 0, stats: { all: 0, draft: 0, published: 0, changed: 0, reported: 0 } }));
    const onNew = vi.fn();
    renderHome({ onNew });
    fireEvent.click(await screen.findByRole("button", { name: "Write the first book" }));
    expect(onNew).toHaveBeenCalled();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search books" }), { target: { value: "zebra" } });
    expect(await screen.findByText("No books match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(last().q).toBe(""));
  });

  it("says when the list cannot be loaded, and tries again", async () => {
    fetchStudioBooks.mockRejectedValueOnce(new Error("The server is not answering."));
    renderHome();
    expect((await screen.findByRole("alert")).textContent).toContain("not answering");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(await screen.findByRole("button", { name: "Book 1" })).toBeTruthy();
  });
});
