import { beforeEach, describe, expect, it } from "vitest";
import { Outbox } from "../lib/sync/outbox";
import { loadPlay, savePlay } from "./playStore";
import { loadSeen, markSeen } from "./seenStore";
import { loadResults } from "./resultsStore";

beforeEach(() => {
  localStorage.clear();
  Outbox.clear();
});

describe("what a child has played in Rebus Rush", () => {
  it("is kept per child, so two children on one tablet do not share a history", () => {
    markSeen(["a", "b"]);
    expect(loadSeen()).toEqual(["a", "b"]);
    expect(loadPlay("someone-else")).toEqual({ seen: [], results: {} });
    savePlay({ seen: ["z"], results: { z: { plays: 1, last: "clean" } } }, "someone-else");
    expect(loadSeen()).toEqual(["a", "b"]);
    expect(loadPlay("someone-else").seen).toEqual(["z"]);
  });

  it("carries over what the device recorded before syncing, once", () => {
    localStorage.setItem("koda.rebus.seen", JSON.stringify(["old-1", "old-2"]));
    localStorage.setItem("koda.rebus.results.v1", JSON.stringify({ "old-1": { plays: 2, last: "helped" }, bad: { plays: "x" } }));
    expect(loadSeen()).toEqual(["old-1", "old-2"]);
    expect(loadResults()).toEqual({ "old-1": { plays: 2, last: "helped" } });
    expect(localStorage.getItem("koda.rebus.seen")).toBeNull();
    expect(localStorage.getItem("koda.rebus.results.v1")).toBeNull();
  });

  it("is queued to reach the child's account whenever it changes", () => {
    markSeen(["a"]);
    const queued = Outbox.peekMutations(10).filter((m) => m.kind === "rebusPlay");
    expect(queued).toHaveLength(1);
    expect(queued[0].body).toMatchObject({ seen: ["a"] });
    markSeen(["b"]);
    const again = Outbox.peekMutations(10).filter((m) => m.kind === "rebusPlay");
    expect(again).toHaveLength(1);
    expect(again[0].body).toMatchObject({ seen: ["a", "b"] });
  });

  it("starts fresh, never throws, when storage holds nonsense", () => {
    localStorage.setItem("koda_rebus_play_v1__local", "{not json");
    expect(() => loadPlay()).not.toThrow();
    expect(loadPlay()).toEqual({ seen: [], results: {} });
  });
});
