import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  saveStudioItem: vi.fn(async () => ({})),
  deleteStudioItem: vi.fn(async () => undefined),
  fetchStudioItems: vi.fn(async () => []),
}));
vi.mock("../data/api", () => api);

import { GOLDEN_ITEMS } from "../fixtures/items";
import { TraceDrafts, newDraft } from "./drafts";

describe("Trace Studio drafts", () => {
  beforeEach(() => {
    localStorage.clear();
    TraceDrafts.resetForTests();
    vi.useFakeTimers();
    api.saveStudioItem.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a draft the device cannot store is still kept and still sent to the server", async () => {
    // A full device: every write is refused (a large guide picture used to do this).
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const draft = newDraft({ ...structuredClone(GOLDEN_ITEMS[0]), id: "t-big", title: "Birds" });
    expect(TraceDrafts.save(draft)).toBe(false);
    expect(TraceDrafts.storedHere()).toBe(false);
    // Still there while the page is open…
    expect(TraceDrafts.get("t-big")?.item.title).toBe("Birds");
    // …and on its way to the server.
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.saveStudioItem).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ id: "t-big" }) }));
  });
});
