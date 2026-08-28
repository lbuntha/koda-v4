/**
 * What the deployment allows, according to the operator.
 *
 * A ceiling, not a preference. Everything else in this folder is one family's
 * data; these are the admin's answers for the whole service, and no family
 * setting can raise one. A skill a family switched on stays off if the
 * deployment says the feature behind it is off.
 *
 * Cached in `localStorage` and read synchronously, for the reason permissions
 * are: a screen that waits on a request before deciding what to draw flickers
 * on every load, and an offline device still has to draw something. The cache
 * is for *drawing* — the routes that matter check the real thing, so a stale
 * copy can only ever offer a button that then says no.
 */

import { request } from "./api";
import { accessToken } from "./session";

const CACHE_KEY = "koda_system_v1";

export type SystemSettings = Record<string, boolean | string>;

/**
 * What the app assumes before it has ever been told.
 *
 * Permissive on purpose, and the opposite of how the permission cache starts:
 * an unknown *right* must not flash a parent-only page onto a child's tablet,
 * but an unknown *feature* that starts hidden would leave a deployment with no
 * network looking broken. The server refuses either way.
 */
const ASSUMED: SystemSettings = {
  // The master over the four below it. The server applies it to what it sends
  // (`with_master_applied`), so a device that has heard from the server sees
  // the capabilities already false — this is only what to assume before that.
  "ai.enabled": true,
  "ai.chat": true,
  "ai.speech": true,
  "ai.liveVoice": true,
  "ai.whiteboard": true,
  "account.signupOpen": true,
  "sync.enabled": true,
  "system.readOnly": false,
  "system.notice": "",
};

let settings: SystemSettings = load();
const listeners = new Set<() => void>();

function load(): SystemSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...ASSUMED, ...(JSON.parse(raw) as SystemSettings) } : { ...ASSUMED };
  } catch {
    return { ...ASSUMED };
  }
}

function store(next: SystemSettings): void {
  settings = { ...ASSUMED, ...next };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* drawing hint only — losing it costs a fetch, not correctness */
  }
  listeners.forEach((fn) => fn());
}

/** Refresh from the server. Quiet on failure: offline keeps what was cached. */
export async function refreshSystem(): Promise<void> {
  const token = await accessToken();
  if (!token) return;
  try {
    store(await request<SystemSettings>("/system", { token }));
  } catch {
    /* the cached copy stands */
  }
}

/**
 * Is this feature switched on for the deployment?
 *
 * The question every caller actually has. A setting nobody has heard of is on —
 * a client older than a switch should keep working, and the server is what
 * actually refuses.
 */
export function systemAllows(settingId: string): boolean {
  return settings[settingId] !== false;
}

/** The operator's message to everybody, when there is one. */
export function systemNotice(): string {
  const notice = settings["system.notice"];
  return typeof notice === "string" ? notice : "";
}

export const System = {
  allows: systemAllows,
  notice: systemNotice,
  refresh: refreshSystem,
  snapshot: (): SystemSettings => settings,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
