/**
 * The owner's Rebus Rush settings, as this device last heard them.
 *
 * The operator edits them on the Admin page; every device gets them with the
 * rest of the system settings and keeps the last copy, so a child with no
 * connection plays by the last rules they saw. Whatever arrives is clamped by
 * `normalizeSettings`, and anything unreadable falls back to the defaults.
 */

import { useMemo, useSyncExternalStore } from "react";
import { System } from "../lib/sync/system";
import { DEFAULT_SETTINGS, normalizeSettings, type RebusSettings } from "./settings";

export const REBUS_SETTING = "rebus.settings";

export const parseRebusSettings = (value: unknown): RebusSettings => {
  try {
    return normalizeSettings(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const useRebusSettings = (): RebusSettings => {
  const all = useSyncExternalStore(System.subscribe, System.snapshot);
  const raw = all[REBUS_SETTING];
  return useMemo(() => parseRebusSettings(raw), [raw]);
};
