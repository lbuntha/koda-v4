import { beforeEach, describe, expect, it } from "vitest";

import { bulkGet, bulkRemove, bulkSet } from "./bulkStore";

// jsdom has no IndexedDB, so these cover the fallback every old device takes.
beforeEach(() => localStorage.clear());

describe("bulkStore without IndexedDB", () => {
  it("keeps and returns a copy in localStorage", async () => {
    expect(await bulkSet("k", "hello")).toBe(true);
    expect(await bulkGet("k")).toBe("hello");
    expect(localStorage.getItem("k")).toBe("hello");
  });

  it("answers null for a key it never had", async () => {
    expect(await bulkGet("missing")).toBeNull();
  });

  it("reports false rather than throwing when storage is full", async () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    try {
      expect(await bulkSet("k", "x")).toBe(false);
    } finally {
      Storage.prototype.setItem = real;
    }
  });

  it("forgets a key", async () => {
    await bulkSet("k", "v");
    await bulkRemove("k");
    expect(await bulkGet("k")).toBeNull();
  });
});
