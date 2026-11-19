import { beforeEach, describe, expect, it } from "vitest";
import { closeItems, closedKeys, fitsAge, showing, SHOW_DAYS, type NewItem } from "./whatsNew";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 20, 9);

const item = (kind: NewItem["kind"], id: string, daysAgo: number, extra: Partial<NewItem> = {}): NewItem => ({
  kind,
  id,
  title: id,
  publishedAt: NOW - daysAgo * DAY,
  ...extra,
});

describe("whatsNew", () => {
  beforeEach(() => localStorage.clear());

  it("shows what was published in the last few days, newest first", () => {
    const items = [item("skill", "old", SHOW_DAYS + 1), item("book", "b", 2), item("rebus", "release-4", 0.5)];
    expect(showing(items, new Set(), NOW).map((i) => i.id)).toEqual(["release-4", "b"]);
  });

  it("keeps showing after a tap; only closing hides it", () => {
    const items = [item("skill", "dots", 1), item("book", "b", 1)];
    expect(showing(items, closedKeys("kid"), NOW)).toHaveLength(2);

    closeItems("kid", [items[0]], items);

    expect(showing(items, closedKeys("kid"), NOW).map((i) => i.id)).toEqual(["b"]);
    expect(showing(items, closedKeys("sibling"), NOW)).toHaveLength(2);
  });

  it("forgets closed items once they leave the list", () => {
    const a = item("skill", "a", 1);
    closeItems("kid", [a], [a]);
    closeItems("kid", [], []);
    expect(closedKeys("kid").size).toBe(0);
  });

  it("matches a book to the learner's age", () => {
    expect(fitsAge(item("book", "b", 0, { ages: [5, 7] }), 6)).toBe(true);
    expect(fitsAge(item("book", "b", 0, { ages: [5, 7] }), 12)).toBe(false);
    expect(fitsAge(item("book", "b", 0), 12)).toBe(true);
  });
});
