import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Getting a book's recordings onto a device, over the connection this app is
 * actually used on: slow, and dropping constantly.
 *
 * The promise is "slow the first time, instant afterwards". What these check is
 * the first time — that it finishes at all when the network hangs, that a clip
 * lost to a blip is asked for again, that a phone is not asked to hold forty
 * requests open at once, and that what did arrive is kept so the next attempt
 * only asks for the rest.
 */

vi.mock("../lib/sync", () => ({ API_BASE: "/v1" }));
vi.mock("../lib/sync/session", () => ({ accessToken: async () => "token" }));

const clip = (n = 64) => "a".repeat(n);
// jsdom's own Blob cannot be put in a Response, and the cache stores Responses.
const bytes = () => new NodeBlob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" });
/** Only `ok` and `blob()` are ever read from a clip response. */
const ok = () => ({ ok: true, status: 200, blob: async () => bytes() });

/** No Cache Storage in jsdom; a map stands in for what a device keeps between visits. */
const saved = new Map<string, Response>();
const cacheStub = {
  open: async () => ({
    match: async (key: string) => saved.get(key)?.clone(),
    put: async (key: string, res: Response) => { saved.set(key, res.clone()); },
  }),
};

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
  saved.clear();
  vi.stubGlobal("caches", cacheStub);
  vi.stubGlobal("navigator", { onLine: true });
  URL.createObjectURL = () => "blob:clip";
  URL.revokeObjectURL = () => {};
});

describe("saving a book's recordings", () => {
  it("gives up on a request that hangs, instead of waiting for ever", async () => {
    vi.useFakeTimers();
    // A connection that accepts the request and then says nothing — the state a
    // book was left in when it sat on "preparing audio" and never moved.
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const { clipUrl } = await import("./clips");

    const result = clipUrl(clip());
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(result).resolves.toBeNull();
  });

  it("asks again for a clip lost to a blip, and keeps it once it arrives", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    const { clipUrl } = await import("./clips");

    await expect(clipUrl(clip())).resolves.toBe("blob:clip");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops asking when the device knows it is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const { clipUrl } = await import("./clips");

    await expect(clipUrl(clip())).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks for a few at a time, not for all of them at once", async () => {
    let open = 0;
    let mostAtOnce = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      mostAtOnce = Math.max(mostAtOnce, ++open);
      await new Promise((r) => setTimeout(r, 1));
      open--;
      return ok();
    }));
    const { prefetchClips } = await import("./clips");

    const ids = Array.from({ length: 12 }, (_, i) => clip().slice(0, 63) + i.toString(16));
    await expect(prefetchClips(ids)).resolves.toEqual({ ready: 12, total: 12 });
    expect(mostAtOnce).toBeLessThanOrEqual(3);
  });

  it("only asks for what is still missing when a save is resumed", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const { prefetchClips } = await import("./clips");

    const ids = ["a", "b", "c"].map((c) => c.repeat(64));
    await prefetchClips(ids.slice(0, 2));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // The two already on the device are read from the cache; only the third is asked for.
    fetchMock.mockClear();
    await expect(prefetchClips(ids)).resolves.toEqual({ ready: 3, total: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("counts up as each one lands, so a slow save can show it is moving", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok()));
    const { prefetchClips } = await import("./clips");

    const seen: number[] = [];
    const ids = ["a", "b", "c", "d"].map((c) => c.repeat(64));
    await prefetchClips(ids, ({ ready }) => seen.push(ready));

    expect(seen.at(-1)).toBe(4);
    expect(seen).toHaveLength(4);
  });

  it("reports the ones that did arrive when others could not", async () => {
    const missing = "a".repeat(64);
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes(missing) ? { ok: false, status: 404, blob: async () => bytes() } : ok()));
    const { prefetchClips } = await import("./clips");

    const ids = ["a", "b", "c"].map((c) => c.repeat(64));
    // The two that arrived still read aloud; the page is not silenced by the third.
    await expect(prefetchClips(ids)).resolves.toEqual({ ready: 2, total: 3 });
  });

  it("does not ask twice for a clip the server says it does not have", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, blob: async () => bytes() }));
    vi.stubGlobal("fetch", fetchMock);
    const { clipUrl } = await import("./clips");

    await expect(clipUrl(clip())).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does ask again when the server is having a moment", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, blob: async () => bytes() })
      .mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    const { clipUrl } = await import("./clips");

    await expect(clipUrl(clip())).resolves.toBe("blob:clip");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
