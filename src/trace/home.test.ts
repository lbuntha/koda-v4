import { describe, expect, it } from "vitest";
import type { ItemProgress } from "./progress/ladder";
import { homeRows, stateOf, uniqueById } from "./home";

const p = (over: Partial<ItemProgress>): ItemProgress => ({ step: "watch", status: "learning", updatedAt: 0, ...over }) as ItemProgress;

describe("Trace home", () => {
  it("shows each item once, keeping the first (published) entry", () => {
    const got = uniqueById([{ item: { id: "a" }, from: "c1" }, { item: { id: "b" }, from: "c1" }, { item: { id: "a" }, from: "draft" }]);
    expect(got.map((e) => `${e.item.id}:${e.from}`)).toEqual(["a:c1", "b:c1"]);
  });

  it("puts the most recently practised unfinished collection in the banner, and sorts rows", () => {
    const progress: Record<string, ItemProgress> = {
      a1: p({ step: "guided", updatedAt: 10 }),
      b1: p({ step: "guided", updatedAt: 50 }),
      d1: p({ status: "canDo", step: "memory", updatedAt: 5 }),
    };
    const get = (id: string) => progress[id] ?? p({});
    const cs = [
      { id: "A", itemIds: ["a1", "a2"] },
      { id: "B", itemIds: ["b1", "b2"] },
      { id: "C", itemIds: ["c1"] },
      { id: "D", itemIds: ["d1"] },
    ];
    const { hero, rows } = homeRows(cs, get);
    expect(hero?.id).toBe("B");
    expect(rows.map((r) => [r.id, r.collections.map((c) => c.id)])).toEqual([
      ["continue", ["B", "A"]],
      ["new", ["C"]],
      ["finished", ["D"]],
    ]);
    expect(stateOf(cs[3], get)).toMatchObject({ done: 1, total: 1, started: true });
  });

  it("offers the first new collection when nothing is under way, and a finished one to go again when all are done", () => {
    const fresh = homeRows([{ id: "A", itemIds: ["x"] }], () => p({}));
    expect(fresh.hero?.id).toBe("A");
    expect(fresh.rows.map((r) => r.id)).toEqual(["new"]);
    const done = homeRows([{ id: "A", itemIds: ["x"] }], () => p({ status: "learned" }));
    expect(done.hero?.id).toBe("A");
    expect(homeRows([], () => p({})).hero).toBeNull();
  });
});
