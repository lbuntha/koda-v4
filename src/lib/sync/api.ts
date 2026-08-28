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
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // A failed fetch is the offline case, and offline is not an error state in
    // this app — the caller decides whether it is worth saying anything.
    throw new ApiError(0, "network", "No connection to the data service.");
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
