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
  stashGuardian() {
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

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
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

  const res = await fetch(`${API_URL}${path}`, { method: opts.method ?? "GET", headers, body });

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
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: Record<string, string>) =>
    request<T>(path, { method: "POST", form, auth: false }),
};
