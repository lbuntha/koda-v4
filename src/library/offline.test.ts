import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a child's device does with no network — the promise that matters most on
 * an unstable connection. Each test takes the network away and checks the library
 * still has a shelf, still remembers where the child got to, and still plays the
 * recordings it saved.
 */

const fetchPublished = vi.fn();
vi.mock("./api", () => ({ fetchPublished: (...a: unknown[]) => fetchPublished(...a) }));
vi.mock("../lib/sync/session", () => ({ accessToken: async () => "t" }));
vi.mock("../lib/sync", () => ({ API_BASE: "/v1" }));

import { BookStore } from "./bookStore";
import { LibraryProgress } from "./progress";
import { STARTER_PASSAGES } from "./data/starterPassages";
import type { Passage } from "./data/passage";

const book = (id: string, rev = 1): Passage => ({ ...STARTER_PASSAGES[0], id, rev, title: `Book ${id}` });

beforeEach(() => {
  localStorage.clear();
  fetchPublished.mockReset();
  BookStore.reset([]);
  LibraryProgress.clear();
});

describe("the shelf", () => {
  it("is never empty: the starter books are there on a device that has never been online", async () => {
    fetchPublished.mockRejectedValue(new Error("offline"));
    await BookStore.refresh();
    expect(BookStore.shelf().map((p) => p.id)).toEqual(STARTER_PASSAGES.map((p) => p.id));
  });

  it("keeps the last published books when a refresh fails", async () => {
    fetchPublished.mockResolvedValueOnce([book("farm")]);
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(true);

    fetchPublished.mockRejectedValueOnce(new Error("offline"));
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(true);
  });

  it("survives a reload: published books are stored on the device", async () => {
    fetchPublished.mockResolvedValueOnce([book("farm", 3)]);
    await BookStore.refresh();
    const stored = JSON.parse(localStorage.getItem("koda_library_books_v1")!);
    expect(stored).toEqual([expect.objectContaining({ id: "farm", rev: 3 })]);
  });

  it("lets a published book replace a starter with the same id, so a starter can be corrected", async () => {
    const fixed = { ...STARTER_PASSAGES[0], rev: 2, title: "At the Market (fixed)" };
    fetchPublished.mockResolvedValueOnce([fixed]);
    await BookStore.refresh();
    const shelf = BookStore.shelf();
    expect(shelf.filter((p) => p.id === fixed.id)).toEqual([expect.objectContaining({ title: "At the Market (fixed)", rev: 2 })]);
    expect(shelf).toHaveLength(STARTER_PASSAGES.length);
  });

  it("drops a book the server has taken off the shelf, once the server says so", async () => {
    fetchPublished.mockResolvedValueOnce([book("farm")]);
    await BookStore.refresh();
    fetchPublished.mockResolvedValueOnce([]);
    await BookStore.refresh();
    expect(BookStore.shelf().some((p) => p.id === "farm")).toBe(false);
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
