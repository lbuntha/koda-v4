/**
 * The sidebar, fetched and cached.
 *
 * Cached by family, role and effective permissions. A cache from an operator
 * must never become a parent's sidebar while the parent's request is loading.
 *
 * The server filters by what the caller may do; the client filters again while
 * this is in flight. Neither is security — the routes themselves are.
 */

import { request } from "./api";
import { SessionAPI, accessToken } from "./session";

const CACHE_KEY = "koda_menu_v1";

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | null;
  requires?: string | null;
  order: number;
}

/**
 * Version 3 because the *rules* inside a cached menu can go out of date, not
 * just the labels. A cache written before Art moved to `content:write` still
 * says `settings:write`, which every parent holds — so an offline device would
 * keep drawing an entry the server has already taken away from them. The cache
 * exists to repeat what the server last said, never to outlive it, so a cache
 * from an older rule set is discarded rather than trusted.
 */
interface CachedMenus {
  version: 3;
  menus: Record<string, MenuItem[]>;
}

let cached: CachedMenus = load();
const listeners = new Set<() => void>();

function currentScope(): string | null {
  const session = SessionAPI.current();
  if (!session) return null;
  return JSON.stringify([
    session.familyId ?? "platform",
    session.role,
    session.platformRole ?? "none",
    [...(session.permissions ?? [])].sort(),
  ]);
}

function load(): CachedMenus {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CachedMenus) : null;
    return parsed?.version === 3 && parsed.menus && typeof parsed.menus === "object"
      ? parsed
      : { version: 3, menus: {} };
  } catch {
    return { version: 3, menus: {} };
  }
}

function store(next: MenuItem[], scope: string): void {
  cached = { version: 3, menus: { ...cached.menus, [scope]: next } };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    /* the bundled default still draws */
  }
  listeners.forEach((fn) => fn());
}

/** Refresh from the server. Quiet on failure: the matching scoped cache stands. */
export async function refreshMenu(): Promise<void> {
  const scope = currentScope();
  if (!scope) return;
  const token = await accessToken();
  if (!token) return;
  try {
    const result = await request<{ items: MenuItem[] }>("/menu", { token });
    if (currentScope() === scope && Array.isArray(result.items)) store(result.items, scope);
  } catch {
    /* offline or refused — only this exact account scope's cache may stand */
  }
}

export const Menu = {
  items: (): MenuItem[] | null => {
    const scope = currentScope();
    return scope && Object.prototype.hasOwnProperty.call(cached.menus, scope)
      ? cached.menus[scope]
      : null;
  },
  /** Apply a confirmed server patch immediately to listeners, then let the
   * next refresh reconcile the complete server response. */
  update(id: string, patch: Partial<MenuItem>): void {
    const scope = currentScope();
    const items = Menu.items();
    if (!scope || !items) return;
    store(items.map((item) => (item.id === id ? { ...item, ...patch } : item)), scope);
  },
  refresh: refreshMenu,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
