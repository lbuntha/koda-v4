/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Thin fetch wrapper for the Koda backend (backend/). The base URL comes from
 * VITE_API_URL; when it's unset the app is in "offline mode" and callers fall
 * back to localStorage (so the studio keeps working with no backend running).
 *
 * Tokens are held in localStorage; a 401 triggers one refresh-and-retry.
 */

const API_URL = (import.meta as any).env?.VITE_API_URL as string | undefined;

const ACCESS_KEY = "koda_access_token";
const REFRESH_KEY = "koda_refresh_token";
// When a parent launches a kid, the parent's tokens are stashed here so exiting
// play restores the parent session (and a mid-play refresh returns to them too).
const GUARDIAN_ACCESS_KEY = "koda_guardian_access_token";
const GUARDIAN_REFRESH_KEY = "koda_guardian_refresh_token";

export function isApiConfigured(): boolean {
  return typeof API_URL === "string" && API_URL.length > 0;
}

/** Server routes that serve a *file* the browser loads directly, e.g. via `<img src>`. */
const API_FILE_PREFIX = "/learning/assets/";

/**
 * Resolve an artwork reference to something an `<img>` can load.
 *
 * The API returns published release artwork as an API-relative path
 * (`/learning/assets/{release}/{asset}`), which has to be joined with the API base — under
 * Docker that yields `/api/learning/...` on the same origin, in development
 * `http://localhost:8000/learning/...`. Everything else is passed through untouched: an
 * authored HTTP URL, or a `/assets/...` path shipped with the frontend, both of which would
 * break if they were pointed at the API.
 */
export function apiFileUrl(url: string | null | undefined): string | null | undefined {
  if (!url || !url.startsWith(API_FILE_PREFIX) || !isApiConfigured()) return url;
  return `${API_URL}${url}`;
}

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
  // ── Guardian stash (parent → kid play) ──
  /**
   * Put the adult's session aside so a child's can take its place.
   *
   * Only the *first* call stashes. A second one would overwrite the adult's tokens with
   * whatever is active now — which, once play has started, is the child's. That destroyed the
   * parent's session with no way back: `restoreGuardian` would hand back a student token, and
   * the adult was silently signed out and had to enter their password again.
   *
   * It is easy to reach. Tapping a profile twice does it, and so does picking a second child
   * while already playing as the first — both things children do constantly.
   *
   * The stash is only cleared by `restoreGuardian`, which is the explicit "the adult is back"
   * moment, so "a stash exists" is exactly the right test for "we are already inside play".
   */
  stashGuardian() {
    if (this.hasGuardianStash()) return;
    const a = this.access, r = this.refresh;
    if (a && r) {
      localStorage.setItem(GUARDIAN_ACCESS_KEY, a);
      localStorage.setItem(GUARDIAN_REFRESH_KEY, r);
    }
  },
  hasGuardianStash(): boolean {
    return !!localStorage.getItem(GUARDIAN_ACCESS_KEY);
  },
  restoreGuardian() {
    const a = localStorage.getItem(GUARDIAN_ACCESS_KEY);
    const r = localStorage.getItem(GUARDIAN_REFRESH_KEY);
    if (a && r) this.set(a, r);
    localStorage.removeItem(GUARDIAN_ACCESS_KEY);
    localStorage.removeItem(GUARDIAN_REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The request never reached the server — the device is offline, the host is unresolvable,
 * or the API is down. Distinct from `ApiError` on purpose: an `ApiError(401)` means the
 * server rejected this session and it should be cleared, while an unreachable server says
 * nothing about the session's validity. Conflating the two signed a child out of an
 * installed app the moment they opened it on a train.
 */
export class OfflineError extends Error {
  constructor(path: string, options?: { cause?: unknown }) {
    super(`Cannot reach the Koda server (${path})`, options);
    this.name = "OfflineError";
  }
}

export const isOfflineError = (reason: unknown): reason is OfflineError =>
  reason instanceof OfflineError;

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch (cause) {
    // Losing the network mid-refresh must not cost the learner their tokens.
    throw new OfflineError("/auth/refresh", { cause });
  }
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const data = await res.json();
  tokenStore.set(data.access_token, data.refresh_token);
  return true;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send as application/x-www-form-urlencoded (OAuth2 login expects this). */
  form?: Record<string, string>;
  auth?: boolean;
  /**
   * Hand the request to the browser to finish even if this page goes away.
   *
   * A phone freezes a backgrounded tab: switch apps, lock the screen, or hit Home mid-save
   * and an ordinary fetch is cancelled where it stands. `keepalive` outlives the page, which
   * is the only way a save started on the way out actually lands. The body must stay under
   * 64KB — callers batch for that — and no retry-on-401 is attempted, because by then there
   * may be no page left to retry from.
   */
  keepalive?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}, allowRetry = true): Promise<T> {
  if (!isApiConfigured()) throw new ApiError(0, "API not configured (VITE_API_URL unset)");

  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  if (opts.auth !== false && tokenStore.access) {
    headers.Authorization = `Bearer ${tokenStore.access}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body,
      ...(opts.keepalive ? { keepalive: true } : {}),
    });
  } catch (cause) {
    // `fetch` rejects only when no response was produced at all.
    throw new OfflineError(path, { cause });
  }

  if (res.status === 401 && allowRetry && tokenStore.refresh) {
    if (await tryRefresh()) return request<T>(path, opts, false);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  /** POST that survives the page being backgrounded or closed. See RequestOptions.keepalive. */
  postKeepalive: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body, keepalive: true }, false),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
  postForm: <T>(path: string, form: Record<string, string>) =>
    request<T>(path, { method: "POST", form, auth: false }),
};
