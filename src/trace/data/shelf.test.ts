import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ fetchBundle: vi.fn(), fetchShelf: vi.fn(), sendReport: vi.fn() }));
vi.mock("../../library/photos", () => ({ isPhoto: () => false, photoUrl: vi.fn() }));

import { TraceShelf } from "./shelf";

describe("TraceShelf.read", () => {
  it("hands back the same parsed shelf every time, not a fresh parse per render", () => {
    expect(TraceShelf.read()).toBe(TraceShelf.read());
  });
});

describe("TraceShelf.refresh", () => {
  it("downloads changed collections a few at a time, never one by one or all at once", async () => {
    const api = await import("./api");
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    vi.mocked(api.fetchShelf).mockResolvedValue(ids.map((id) => ({ id, rev: 1 })) as never);
    let open = 0;
    let most = 0;
    vi.mocked(api.fetchBundle).mockImplementation(async (id: string) => {
      open++;
      most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      return { id, rev: 1, items: [] } as never;
    });

    await TraceShelf.refresh();

    expect(api.fetchBundle).toHaveBeenCalledTimes(ids.length);
    expect(most).toBe(3);
    expect(Object.keys(TraceShelf.read().bundles).sort()).toEqual(ids);
  });
});
