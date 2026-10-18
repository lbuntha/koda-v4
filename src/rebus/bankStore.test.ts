import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../lib/sync";
import { useRebusBank } from "./bank";
import { bankSnapshot, parsePuzzles, refreshBank, resetBank } from "./bankStore";
import { OFFICIAL_PUZZLES } from "./content";

vi.mock("../lib/sync", () => ({ accessToken: async () => "token", request: vi.fn() }));

const some = OFFICIAL_PUZZLES.slice(0, 3);
const reply = (version: number, puzzles: unknown, unchanged = false) => vi.mocked(request).mockResolvedValueOnce({ version, unchanged, puzzles });

beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.mocked(request).mockRejectedValue(new Error("offline"));
  resetBank();
});

describe("parsePuzzles", () => {
  it("keeps good puzzles and drops anything malformed, but keeps one naming a drawing added through the Art library", () => {
    const yeti = { ...some[0], id: "x-yeti", pieces: [{ kind: "icon", id: "rebus-yeti", name: "yeti" }] };
    const kept = parsePuzzles([...some, yeti, null, "nope", { id: "bad" }, { ...some[1], id: "x-age", ages: [2, 40] }]);
    expect(kept.map((p) => p.id)).toEqual([...some.map((p) => p.id), "x-yeti"]);
    expect(parsePuzzles("not a list")).toEqual([]);
  });
});

describe("the bank a device plays", () => {
  it("has nothing, and says it has not loaded, until the server has been heard from: children only play what is published", () => {
    const { result } = renderHook(() => useRebusBank());
    expect(result.current.puzzles).toHaveLength(0);
    expect(result.current.loaded).toBe(false);
  });

  it("follows the server's published list once it arrives, so a retired puzzle is no longer played", async () => {
    reply(5, some);
    const { result } = renderHook(() => useRebusBank());
    await waitFor(() => expect(result.current.puzzles).toHaveLength(3));
    expect(result.current.loaded).toBe(true);
    expect(result.current.counts.food + result.current.counts.countries).toBe(3);
    expect(bankSnapshot()?.version).toBe(5);
  });

  it("keeps the last list when the server cannot be reached", async () => {
    reply(5, some);
    await refreshBank({ force: true });
    vi.mocked(request).mockRejectedValue(new Error("offline"));
    await refreshBank({ force: true });
    expect(bankSnapshot()?.puzzles).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem("koda.rebus.bank.v1") ?? "{}").version).toBe(5);
  });

  it("asks only for what changed, and keeps its copy when told nothing has", async () => {
    reply(5, some);
    await refreshBank({ force: true });
    reply(5, [], true);
    await refreshBank({ force: true });
    expect(vi.mocked(request).mock.calls[1][0]).toBe("/rebus/puzzles?since=5");
    expect(bankSnapshot()?.puzzles).toHaveLength(3);
  });

  it("does not ask again within a minute of asking", async () => {
    reply(1, some);
    await refreshBank({ force: true });
    await refreshBank();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("takes an empty list as a real answer: nothing is published, or everything was unpublished", async () => {
    reply(5, some);
    await refreshBank({ force: true });
    reply(9, []);
    await refreshBank({ force: true });
    const { result } = renderHook(() => useRebusBank());
    expect(result.current.puzzles).toHaveLength(0);
    expect(result.current.loaded).toBe(true);
    expect(bankSnapshot()?.version).toBe(9);
  });

  it("does not take an answer that is not a list of puzzles", async () => {
    vi.mocked(request).mockResolvedValueOnce({ version: 3, unchanged: false, puzzles: "oops" });
    await refreshBank({ force: true });
    expect(bankSnapshot()).toBeNull();
  });

  it("updates a screen that is already open when a newer list arrives", async () => {
    const { result } = renderHook(() => useRebusBank());
    reply(2, some.slice(0, 1));
    await act(async () => refreshBank({ force: true }));
    expect(result.current.puzzles).toHaveLength(1);
  });
});
