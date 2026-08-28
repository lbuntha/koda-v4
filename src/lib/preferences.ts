/**
 * Sound, voice and appearance — the three settings a person changes and then
 * expects to stay changed.
 *
 * They lived in three places: theme in its own `localStorage` key inside the
 * theme context, sound in a module flag inside the audio synthesiser, and voice
 * in React state that a reload threw away. That is why none of them followed a
 * family to a second device — there was nothing to sync, only three private
 * habits.
 *
 * One document fixes all three. It is family-scoped on purpose: a parent who
 * turns the chimes off once should find them off on the tablet the child
 * actually uses, which is the whole point of putting settings on the server.
 *
 * The API key in Settings is deliberately *not* here. It is a secret and it is
 * per-device, so it stays in `localStorage` where a sync pull can never carry
 * it to another household member's machine.
 */

import { SyncEngine } from "./sync";

export type ThemeMode = "dark" | "light";

export interface Preferences {
  /** Light or dark surfaces. */
  theme: ThemeMode;
  /** Pops, chimes and fanfares. */
  soundEnabled: boolean;
  /** Koda's spoken guidance. */
  voiceEnabled: boolean;
}

export const PREFERENCE_DEFAULTS: Preferences = {
  // Light is the default: this is a daytime app for young children, and the
  // artwork and paper-white surfaces are drawn for it.
  theme: "light",
  // Off by default — tapping through an activity should be silent until
  // somebody deliberately turns the chimes on.
  soundEnabled: false,
  voiceEnabled: true,
};

/** The key `SYNC_KINDS.preferences` already names, so a pulled doc lands here. */
const STORAGE_KEY = "koda_preferences_v1";

/** Where these three settings lived before they were one document. */
const LEGACY_THEME_KEY = "synthesis_tutor_theme";
const LEGACY_SOUND_KEY = "koda_sound_enabled";

const listeners = new Set<() => void>();
let version = 0;

/** A hand-edited or half-pulled document must still produce a usable app. */
const sanitise = (raw: Partial<Preferences>): Preferences => ({
  theme: raw.theme === "dark" ? "dark" : "light",
  soundEnabled: raw.soundEnabled === true,
  voiceEnabled: raw.voiceEnabled !== false,
});

/**
 * What a device that has these settings under the old keys should start with.
 *
 * Read, never written back: the document is the record from here on, and a
 * migration that kept writing both would give two answers to one question.
 */
const fromLegacyKeys = (): Preferences => {
  try {
    return sanitise({
      theme: localStorage.getItem(LEGACY_THEME_KEY) === "dark" ? "dark" : "light",
      soundEnabled: localStorage.getItem(LEGACY_SOUND_KEY) === "true",
      voiceEnabled: PREFERENCE_DEFAULTS.voiceEnabled,
    });
  } catch {
    return { ...PREFERENCE_DEFAULTS };
  }
};

const load = (): Preferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitise(JSON.parse(raw) as Partial<Preferences>) : fromLegacyKeys();
  } catch {
    return { ...PREFERENCE_DEFAULTS };
  }
};

let current: Preferences = load();

const notify = () => {
  version += 1;
  for (const cb of listeners) cb();
};

/**
 * Save, then queue.
 *
 * Only reached from a deliberate change. Booting does not persist, because a
 * save on load is what turns "this device has never been told" into a revision
 * bump that can overwrite what another device just set.
 */
const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    // One document per family, under one key — there is only ever one set of
    // these settings, so there is nothing to key it by.
    SyncEngine.recordDoc("preferences", "default", current as unknown as Record<string, unknown>);
  } catch {
    // A blocked store must not take the app down: the values still apply for
    // this session, they just do not survive a reload.
  }
  notify();
};

/**
 * A document pulled from another device.
 *
 * `apply.ts` writes the same key and fires a `storage` event, exactly as it does
 * for every other store — so a change made on a parent's laptop reaches this one
 * by the path a second tab already used, and nothing here has to know which of
 * the two it was.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    current = load();
    notify();
  });
}

export const PreferencesAPI = {
  /** Change signal for `useSyncExternalStore`. */
  version: () => version,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  /** The settings in force. Read fresh — nothing should cache these. */
  current(): Preferences {
    return current;
  },

  update(patch: Partial<Preferences>): void {
    const next = sanitise({ ...current, ...patch });
    // Toggling to the value already held is not an edit, and should not cost a
    // revision every time a component re-renders its switch.
    if (
      next.theme === current.theme &&
      next.soundEnabled === current.soundEnabled &&
      next.voiceEnabled === current.voiceEnabled
    ) {
      return;
    }
    current = next;
    persist();
  },

  reset(): void {
    current = { ...PREFERENCE_DEFAULTS };
    persist();
  },
};
