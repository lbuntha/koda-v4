/**
 * Every call to the data service goes through here.
 *
 * One place decides the base URL, attaches the token, and turns the server's
 * error envelope into something a component can show a person. Nothing else in
 * the app calls `fetch` against `/v1`.
 */

/** Same origin by default — Express proxies `/v1` to FastAPI (docs/BACKEND.md §3). */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? "/v1";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** No network, or the service is not running — not the caller's fault. */
  get isOffline(): boolean {
    return this.status === 0 || this.code === "api_unreachable";
  }

  /**
   * The server said *this session is not valid*, as opposed to "I am having
   * trouble". Only this may sign a device out: a 500 or a restart mid-request
   * is the server's problem, and treating it as a rejection would throw a child
   * back to the sign-in screen because a deploy happened while they played.
   */
  get isRejected(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** A server-side fault. Retry later; the session stands. */
  get isServerFault(): boolean {
    return this.status >= 500;
  }

  get isExpired(): boolean {
    return this.code === "token_expired";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer token, when the route needs one. */
  token?: string | null;
  signal?: AbortSignal;
  /** Give up and call it offline after this long. `0` waits forever. */
  timeoutMs?: number;
}

/**
 * How long to wait before calling a request offline.
 *
 * A connection that drops is the easy case: `fetch` rejects and the caller
 * queues. The hard one, and the common one on an unstable link, is a request
 * that connects and then stalls — nothing rejects, and the browser's own limit
 * can be half a minute. Anything waiting on that is stuck for as long, and the
 * sync engine is single-flight, so one stalled flush also holds off the retry
 * that would have worked.
 *
 * Fifteen seconds is far longer than a healthy request and far shorter than
 * giving up on the app.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * The caller's signal, plus a deadline of our own.
 *
 * `AbortSignal.any`/`timeout` are not in every engine this runs in — jsdom
 * included — so it is built by hand rather than feature-detected in two places.
 */
function withDeadline(signal: AbortSignal | undefined, timeoutMs: number) {
  if (timeoutMs <= 0) return { signal, done: () => {} };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const relay = () => controller.abort();
  signal?.addEventListener("abort", relay);
  if (signal?.aborted) controller.abort();

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    },
  };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const deadline = withDeadline(signal, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: deadline.signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // A failed fetch is the offline case, and offline is not an error state in
    // this app — the caller decides whether it is worth saying anything. A
    // request that ran out of time arrives here too, and means the same thing:
    // this device cannot reach the server *now*, so queue it and back off.
    throw new ApiError(0, "network", "No connection to the data service.");
  } finally {
    deadline.done();
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? "Something went wrong. Try again.",
    );
  }

  return payload as T;
}
