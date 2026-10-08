/**
 * Wording corrections from the Translations page, on every device.
 *
 * Offline first, like everything else here: the last set this device received
 * is applied synchronously before the first render — so the sign-in screen is
 * already corrected on a tablet with no signal — and the server is asked for a
 * fresher set afterwards, with a deadline. A failed fetch changes nothing.
 *
 * No session needed: the route is public, because the first screen anybody
 * reads is the one shown before they have signed in.
 */

import { request } from "../sync/api";
import { setOverrides, type CatalogMessage } from "./index";

type Overrides = Record<string, Record<string, CatalogMessage>>;

const STORE_KEY = "koda_translation_overrides_v1";
/** Short: a correction is worth waiting a moment for, not a stalled launch. */
const FETCH_TIMEOUT_MS = 8_000;

let current: Overrides = {};

const keep = (next: Overrides) => {
  current = next;
  setOverrides(next);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full disk: the corrections still apply for this visit.
  }
};

/** The copy kept from last time. Call once, before the first render. */
export function applyCachedOverrides(): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    current = JSON.parse(raw) as Overrides;
    setOverrides(current);
  } catch {
    // A corrupt copy is the same as none: the bundled wording is still right
    // enough to use, and the next fetch replaces it.
  }
}

/** Ask the server for the latest set. Never throws. */
export async function refreshOverrides(): Promise<void> {
  try {
    const result = await request<{ overrides: Overrides }>("/translations", { timeoutMs: FETCH_TIMEOUT_MS });
    if (result && typeof result.overrides === "object") keep(result.overrides);
  } catch {
    // Offline, or the server is older than this route: keep what we have.
  }
}

/** After a save in the editor: show it here at once, without a round trip. */
export function setLocalOverride(lang: string, key: string, text: CatalogMessage | null): void {
  const forLang = { ...(current[lang] ?? {}) };
  if (text === null) delete forLang[key];
  else forLang[key] = text;
  keep({ ...current, [lang]: forLang });
}
