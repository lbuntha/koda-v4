/**
 * Recordings of Khmer spelling units' names — a person saying "ជើងម" for ◌្ម —
 * so a child hears each piece named as they spell, the way a class says it.
 *
 * The list (unit → clip id) is small and kept in localStorage; a refresh has a
 * deadline and a failure keeps what the device had, so it works on the bus.
 * The clips themselves are cached like a book's recordings (`clips.ts`).
 *
 * Without a recording, a unit's name goes to the device's Khmer voice, if it
 * has one; without either, nothing is said and the name is still on screen.
 */

import { useEffect, useSyncExternalStore } from "react";
import { request } from "../lib/sync";
import { accessToken } from "../lib/sync/session";
import { clipUrl } from "./clips";
import { unitName } from "./data/khmerCoach";
import { say } from "./voice";

const KEY = "koda_library_unit_voices_v1";
const DEADLINE_MS = 4_000;
const listeners = new Set<() => void>();
let version = 0;
let voices: Record<string, string> = read();
let inflight: Promise<void> | null = null;

function read(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function set(next: Record<string, string>) {
  voices = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* a full disk keeps the list in memory */
  }
  version++;
  listeners.forEach((l) => l());
}

export const UnitVoices = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  version: () => version,
  all: (): Readonly<Record<string, string>> => voices,
  clipFor: (unit: string): string | undefined => voices[unit],

  /** Ask the server. Resolves either way; a failure keeps the list as it was. */
  refresh(): Promise<void> {
    if (!inflight) {
      inflight = (async () => {
        const body = await request<{ voices: Record<string, string> }>("/library/unit-voices", { token: (await accessToken()) ?? null, timeoutMs: DEADLINE_MS });
        set(body.voices ?? {});
      })()
        .catch(() => {
          /* offline or signed out: the stored list stands */
        })
        .finally(() => {
          inflight = null;
        });
    }
    return inflight;
  },

  /** Record (or, with null, forget) a unit's name. Authors only; the server checks. */
  async save(unit: string, clip: string | null): Promise<void> {
    const body = await request<{ voices: Record<string, string> }>("/library/unit-voices", {
      method: "PUT",
      token: (await accessToken()) ?? null,
      body: { unit, clip },
    });
    set(body.voices ?? {});
  },

  /** For tests. */
  reset(next: Record<string, string> = {}) {
    set(next);
  },
};

/** The recorded names, kept fresh while a screen that uses them is open. */
export function useUnitVoices(): Readonly<Record<string, string>> {
  useSyncExternalStore(UnitVoices.subscribe, UnitVoices.version, UnitVoices.version);
  useEffect(() => {
    void UnitVoices.refresh();
  }, []);
  return voices;
}

/** Fetch the recordings for these units now, so they play offline later. */
export function prefetchUnits(units: readonly string[]): void {
  for (const u of new Set(units)) {
    const clip = voices[u];
    if (clip) void clipUrl(clip);
  }
}

/** Say a unit's name: its recording, else the device's Khmer voice, else nothing. */
export const sayUnit = (unit: string): Promise<boolean> => say(unitName(unit), "km", voices[unit]);
