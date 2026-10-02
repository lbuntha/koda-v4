import { describe, expect, it } from "vitest";
import { collectionStatus, matches, pageOf, sortBy, usage } from "./listView";

describe("studio list view", () => {
  const n = Array.from({ length: 50 }, (_, i) => i + 1);

  it("cuts one page and clamps a page past the end", () => {
    expect(pageOf(n, 1, 24)).toMatchObject({ total: 50, page: 1, pages: 3 });
    expect(pageOf(n, 1, 24).rows).toHaveLength(24);
    expect(pageOf(n, 3, 24).rows).toEqual([49, 50]);
    expect(pageOf(n, 9, 24).page).toBe(3);
    expect(pageOf([], 1, 24)).toMatchObject({ rows: [], page: 1, pages: 1 });
  });

  it("searches without minding case, and an empty search matches all", () => {
    expect(matches("Ka", "ka")).toBe(true);
    expect(matches("ក", " ក ")).toBe(true);
    expect(matches("Ka", "")).toBe(true);
    expect(matches("Ka", "x")).toBe(false);
  });

  it("sorts newest first or by title", () => {
    const rows = [{ t: "b", u: 1 }, { t: "a", u: 2 }];
    expect(sortBy(rows, "recent", (r) => r.t, (r) => r.u).map((r) => r.t)).toEqual(["a", "b"]);
    expect(sortBy(rows, "title", (r) => r.t, (r) => r.u).map((r) => r.t)).toEqual(["a", "b"]);
    expect(sortBy([{ t: "b", u: 2 }, { t: "a", u: 1 }], "title", (r) => r.t, (r) => r.u).map((r) => r.t)).toEqual(["a", "b"]);
  });

  it("names where a collection stands, review first", () => {
    expect(collectionStatus({ reviewState: "pending", publishedRev: 2, changed: true })).toBe("pending");
    expect(collectionStatus({ reviewState: "rejected", publishedRev: null, changed: false })).toBe("rejected");
    expect(collectionStatus({ publishedRev: null, changed: true })).toBe("draft");
    expect(collectionStatus({ publishedRev: 1, changed: true })).toBe("changed");
    expect(collectionStatus({ publishedRev: 1, changed: false })).toBe("published");
  });

  it("counts the collections each item is in, once per collection", () => {
    const u = usage([{ itemIds: ["a", "b", "a"] }, { itemIds: ["a"] }]);
    expect(u.get("a")).toBe(2);
    expect(u.get("b")).toBe(1);
    expect(u.get("c")).toBeUndefined();
  });
});
