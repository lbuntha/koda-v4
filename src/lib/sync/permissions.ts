/**
 * What this account may do, according to the server.
 *
 * Fetched once and cached, because the answer changes only when a role does —
 * and because a sidebar that waits on a request to decide what to draw flickers
 * on every load. The cache is a convenience for *drawing*; every route still
 * checks the real thing, so a stale copy can only ever show a menu entry that
 * then says no.
 */

import { request } from "./api";
import { SessionAPI, accessToken } from "./session";

const CACHE_KEY = "koda_permissions_v1";

interface Matrix {
  permissions: string[];
  roles: Record<string, string[]>;
  platformRoles: Record<string, string[]>;
  grantOnly: string[];
  assignableRoles: string[];
}

let matrix: Matrix | null = load();
const listeners = new Set<() => void>();

function load(): Matrix | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Matrix) : null;
  } catch {
    return null;
  }
}

function store(next: Matrix): void {
  matrix = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* drawing hint only — losing it costs a fetch, not correctness */
  }
  listeners.forEach((fn) => fn());
}

/** Refresh the table. Quiet on failure: offline keeps whatever was cached. */
export async function refreshPermissions(): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  try {
    store(await request<Matrix>("/family/permissions", { token }));
  } catch {
    /* the cached copy stands */
  }
}

/**
 * May the signed-in account do this?
 *
 * Unknown while the table has never been fetched — callers treat that as "not
 * yet", so a parent-only entry never flashes up on a child's tablet.
 */
export function can(permission: string): boolean {
  const session = SessionAPI.current();
  if (!session) return false;

  // The token's own set first: it is the role *plus this person's exceptions*,
  // which the role table alone cannot express.
  if (session.permissions?.length) return session.permissions.includes(permission);

  if (!matrix) return false;
  if (matrix.roles[session.role]?.includes(permission)) return true;
  const platform = session.platformRole ?? "none";
  return Boolean(
    !matrix.grantOnly.includes(permission) && matrix.platformRoles[platform]?.includes(permission),
  );
}

export const Permissions = {
  can,
  refresh: refreshPermissions,
  known: (): boolean => matrix !== null,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: (): Matrix | null => matrix,
};
