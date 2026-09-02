import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "./api";

/**
 * A request that stalls is not the same failure as one that fails.
 *
 * On an unstable connection — the normal case for a lot of the children this is
 * for — the link comes up, the request goes out, and nothing comes back. Fetch
 * does not reject; it waits, for as long as the browser's own limit, which can
 * be half a minute. Everything behind it waits too, and the sync engine is
 * single-flight, so one stalled flush also holds off the retry that would have
 * worked. The deadline turns that into the offline case, which this app already
 * knows how to handle: queue it, back off, try again.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A network that connects and then says nothing, until it is aborted. */
const stalls = () =>
  vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  );

describe("a request that never answers", () => {
  it("is reported as offline rather than waiting for the browser to give up", async () => {
    vi.stubGlobal("fetch", stalls());

    const pending = request("/anything").catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(15_000);

    const error = await pending;
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("network");
  });

  it("waits the whole deadline before saying so", async () => {
    vi.stubGlobal("fetch", stalls());

    let settled = false;
    const pending = request("/anything").catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(14_000);
    expect(settled, "gave up on a slow but working connection").toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    await pending;
    expect(settled).toBe(true);
  });

  it("honours a shorter deadline a caller asks for", async () => {
    vi.stubGlobal("fetch", stalls());

    const pending = request("/speech", { timeoutMs: 4_000 }).catch(() => "gave up");
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await pending).toBe("gave up");
  });

  it("leaves the caller's own abort working", async () => {
    vi.stubGlobal("fetch", stalls());
    const controller = new AbortController();

    const pending = request("/anything", { signal: controller.signal }).catch(() => "aborted");
    controller.abort();
    expect(await pending).toBe("aborted");
  });
});

describe("a request that answers", () => {
  it("clears its timer, so a slow-but-fine call is not aborted later", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ ok: true }) }) as Response),
    );

    await expect(request("/anything")).resolves.toEqual({ ok: true });
    // Nothing left pending: an uncleared abort timer would fire into a
    // finished request and, over a session, into whatever ran after it.
    expect(vi.getTimerCount()).toBe(0);
  });
});
