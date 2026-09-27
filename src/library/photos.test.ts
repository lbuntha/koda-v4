import { Blob as NodeBlob } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Getting a book's pictures onto a device, over the connection this app is
 * actually used on.
 *
 * The pictures are the heaviest thing a book carries — several times its
 * recordings — so the same rules the recordings follow apply here: a deadline
 * on every request, a few at a time, and a second try for a blip but not for a
 * picture the server does not have.
 */

vi.mock("../lib/sync", () => ({ API_BASE: "/v1" }));
vi.mock("../lib/sync/session", () => ({ accessToken: async () => "token" }));

const photo = (c: string) => `photo-${c.repeat(64)}`;
const bytes = () => new NodeBlob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
const ok = () => ({ ok: true, status: 200, blob: async () => bytes() });

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
  URL.createObjectURL = () => "blob:photo";
  URL.revokeObjectURL = () => {};
});

const book = (keys: string[]) => ({
  picture: keys[0] ?? null,
  sentences: keys.slice(1).map((picture, i) => ({ id: `s${i}`, picture })),
  pictures: {},
}) as never;

describe("saving a book's pictures", () => {
  it("gives up on a request that hangs, instead of waiting for ever", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const { photoUrl } = await import("./photos");

    const result = photoUrl(photo("a"));
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(result).resolves.toBeNull();
  });

  it("asks again for a picture lost to a blip", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    const { photoUrl } = await import("./photos");

    await expect(photoUrl(photo("a"))).resolves.toBe("blob:photo");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not ask twice for a picture the server says it does not have", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, blob: async () => bytes() }));
    vi.stubGlobal("fetch", fetchMock);
    const { photoUrl } = await import("./photos");

    await expect(photoUrl(photo("a"))).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops asking when the device knows it is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    const { photoUrl } = await import("./photos");

    await expect(photoUrl(photo("a"))).resolves.toBeNull();
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
    const { prefetchPhotos } = await import("./photos");

    const keys = "abcdefghijkl".split("").map(photo);
    await expect(prefetchPhotos(book(keys))).resolves.toEqual({ ready: 12, total: 12 });
    expect(mostAtOnce).toBeLessThanOrEqual(3);
  });

  it("shows the ones that arrived when another could not", async () => {
    const missing = photo("a");
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes(missing.slice("photo-".length)) ? { ok: false, status: 404, blob: async () => bytes() } : ok()));
    const { prefetchPhotos } = await import("./photos");

    await expect(prefetchPhotos(book([photo("a"), photo("b"), photo("c")]))).resolves.toEqual({ ready: 2, total: 3 });
  });

  it("only asks for what is still missing when a save is resumed", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const { prefetchPhotos } = await import("./photos");

    await prefetchPhotos(book([photo("a"), photo("b")]));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    await expect(prefetchPhotos(book([photo("a"), photo("b"), photo("c")]))).resolves.toEqual({ ready: 3, total: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
