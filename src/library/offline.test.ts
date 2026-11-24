import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a child's device does with no network — the promise that matters most on
 * an unstable connection. Each test takes the network away and checks the library
 * still has a shelf, still remembers where the child got to, and still plays the
 * recordings it saved.
 */

const fetchPublished = vi.fn();
const fetchShelfIndex = vi.fn();
const fetchBooks = vi.fn();
vi.mock("./api", () => ({
  BATCH_MAX: 2,
  fetchPublished: (...a: unknown[]) => fetchPublished(...a),
  fetchShelfIndex: (...a: unknown[]) => fetchShelfIndex(...a),
  fetchBooks: (...a: unknown[]) => fetchBooks(...a),
}));
vi.mock("../lib/sync/session", () => ({ accessToken: async () => "t" }));
vi.mock("../lib/sync", () => ({ API_BASE: "/v1" }));

import { BookStore } from "./bookStore";
import { LibraryProgress } from "./progress";
import { STARTER_PASSAGES } from "./data/starterPassages";
import type { Passage } from "./data/passage";
import { ApiError } from "../lib/sync/api";

const book = (id: string, rev = 1): Passage => ({ ...STARTER_PASSAGES[0], id, rev, title: `Book ${id}` });

/** A server whose shelf is `books`: the index, and batches answered from it. */
const serve = (books: Passage[]) => {
  fetchShelfIndex.mockResolvedValue(books.map((b) => ({ id: b.id, rev: b.rev })));
  fetchBooks.mockImplementation(async (ids: string[]) => books.filter((b) => ids.includes(b.id)));
};

beforeEach(() => {
  localStorage.clear();
  fetchPublished.mockReset();
  fetchShelfIndex.mockReset();
  fetchBooks.mockReset();
  BookStore.reset([]);
  LibraryProgress.clear();
});

describe("the shelf", () => {
  it("is never empty: the starter books are there on a device that has never been online", async () => {
    fetchShelfIndex.mockRejectedValue(new Error("offline"));
    await BookStore.refresh();
    expect(BookStore.shelf().map((p) => p.id)).toEqual(STARTER_PASSAGES.map((p) => p.id));
  });

  it("keeps the last published books when a refresh fails", async () => {
    serve([book("farm")]);
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(true);

    fetchShelfIndex.mockRejectedValueOnce(new Error("offline"));
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(true);
  });

  it("survives a reload: published books are stored on the device", async () => {
    serve([book("farm", 3)]);
    await BookStore.refresh();
    await new Promise((r) => setTimeout(r, 0));
    const { bulkGet } = await import("../lib/bulkStore");
    expect(JSON.parse((await bulkGet("koda_library_books_v1"))!)).toEqual([expect.objectContaining({ id: "farm", rev: 3 })]);
  });

  it("shows the starter books only while nothing is published", async () => {
    expect(BookStore.shelf().map((p) => p.id)).toEqual(STARTER_PASSAGES.map((p) => p.id));
    serve([book("farm")]);
    await BookStore.refresh();
    // Real books in: the shelf is exactly what was published — no starter left to delete.
    expect(BookStore.shelf().map((p) => p.id)).toEqual(["farm"]);
  });

  it("drops a book the server has taken off the shelf, once the server says so", async () => {
    serve([book("farm")]);
    await BookStore.refresh();
    serve([]);
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(false);
  });
});

describe("a big shelf on a slow line", () => {
  it("downloads only the books that are new or changed", async () => {
    serve([book("a"), book("b"), book("c")]);
    await BookStore.refresh();
    // Three books, two a batch.
    expect(fetchBooks.mock.calls).toEqual([[["a", "b"]], [["c"]]]);

    fetchBooks.mockClear();
    serve([book("a"), book("b"), book("c")]);
    await BookStore.refresh();
    expect(fetchBooks).not.toHaveBeenCalled();

    serve([book("a"), book("b", 2), book("c"), book("d")]);
    await BookStore.refresh();
    expect(fetchBooks.mock.calls).toEqual([[["b", "d"]]]);
    expect(BookStore.shelf().map((p) => [p.id, p.rev])).toEqual([["a", 1], ["b", 2], ["c", 1], ["d", 1]]);
  });

  it("keeps the older revision when the batch with the new one fails", async () => {
    serve([book("a"), book("b")]);
    await BookStore.refresh();

    fetchShelfIndex.mockResolvedValueOnce([{ id: "a", rev: 1 }, { id: "b", rev: 2 }, { id: "new", rev: 1 }]);
    fetchBooks.mockRejectedValueOnce(new Error("dropped"));
    await BookStore.refresh();
    // "b" stays at the revision the device has; "new" waits for the next refresh.
    expect(BookStore.shelf().map((p) => [p.id, p.rev])).toEqual([["a", 1], ["b", 1]]);
  });

  it("takes the whole shelf from a server that has no index yet", async () => {
    fetchShelfIndex.mockRejectedValueOnce(new ApiError(404, "not_found", "not found"));
    fetchPublished.mockResolvedValueOnce([book("old-server")]);
    await BookStore.refresh();
    expect(BookStore.shelf().map((p) => p.id)).toEqual(["old-server"]);
  });
});

describe("progress", () => {
  it("is kept per child, so one child finishing a book does not finish it for another", () => {
    LibraryProgress.set("farm", { stage: "done", rev: 1 }, "child-a");
    expect(LibraryProgress.get("farm", 1, "child-a")?.stage).toBe("done");
    expect(LibraryProgress.get("farm", 1, "child-b")).toBeNull();
  });

  it("is kept per revision, so a republished book is new again", () => {
    LibraryProgress.set("farm", { stage: "done", rev: 1 }, "child-a");
    expect(LibraryProgress.get("farm", 2, "child-a")).toBeNull();
  });

  it("never moves a finished book backwards by opening it again", () => {
    LibraryProgress.set("farm", { stage: "done", rev: 1, firstTry: 7, total: 7 }, "child-a");
    LibraryProgress.set("farm", { stage: "read", rev: 1 }, "child-a");
    expect(LibraryProgress.get("farm", 1, "child-a")).toMatchObject({ stage: "done", firstTry: 7 });
  });

  it("does not throw when storage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => LibraryProgress.set("farm", { stage: "read", rev: 1 }, "child-a")).not.toThrow();
    spy.mockRestore();
  });
});

describe("recordings", () => {
  it("plays a saved recording with no network, and gives up quietly on one it never saved", async () => {
    // A tiny in-memory Cache Storage, since jsdom has none.
    const store = new Map<string, Response>();
    const cache = {
      match: async (k: string) => store.get(k)?.clone(),
      put: async (k: string, r: Response) => { store.set(k, r); },
    };
    vi.stubGlobal("caches", { open: async () => cache });
    const created = vi.fn(() => "blob:clip");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created }));
    const net = vi.fn(async () => { throw new TypeError("offline"); });
    vi.stubGlobal("fetch", net);

    const { clipUrl } = await import("./clips");
    await cache.put("/library-audio/" + "a".repeat(64), new Response("wav", { headers: { "Content-Type": "audio/wav" } }));

    expect(await clipUrl("a".repeat(64))).toBe("blob:clip");
    expect(net).not.toHaveBeenCalled();
    expect(await clipUrl("b".repeat(64))).toBeNull();
    vi.unstubAllGlobals();
  });
});
