/**
 * Theme preference for the app's people-facing pages (student bands and the parent home).
 *
 * `index.css` drives Tailwind's `dark:` variant from an explicit `.dark` class rather than
 * the OS setting, so a page opts in by putting `dark` on its own root element. That
 * keeps the theme scoped: admin screens and the game canvases (which take their own `isDark`
 * prop) are unaffected by what a learner or parent picks here.
 *
 * First visit follows the OS and keeps following it live; once the learner chooses, that
 * choice is remembered and wins.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "koda_theme";

export const parseThemeMode = (value: string | null | undefined): ThemeMode | null =>
  value === "light" || value === "dark" ? value : null;

export const oppositeThemeMode = (mode: ThemeMode): ThemeMode =>
  mode === "dark" ? "light" : "dark";

/** A stored choice always wins; without one, follow the OS. */
export const resolveThemeMode = (
  stored: ThemeMode | null,
  system: ThemeMode,
): ThemeMode => stored ?? system;

const canUseDom = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const readStoredThemeMode = (): ThemeMode | null => {
  if (!canUseDom()) return null;
  try {
    return parseThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null; // Private browsing or a blocked store: fall back to the OS.
  }
};

export const systemThemeMode = (): ThemeMode =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

export type ThemeState = [ThemeMode, () => void];

const useLocalThemeMode = (): ThemeState => {
  const [stored, setStored] = useState<ThemeMode | null>(readStoredThemeMode);
  const [system, setSystem] = useState<ThemeMode>(systemThemeMode);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (event: MediaQueryListEvent) => setSystem(event.matches ? "dark" : "light");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const toggle = useCallback(() => {
    setStored(current => {
      const next = oppositeThemeMode(resolveThemeMode(current, systemThemeMode()));
      if (canUseDom()) {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Preference is still applied for this session even if it cannot be saved.
        }
      }
      return next;
    });
  }, []);

  return [resolveThemeMode(stored, system), toggle];
};

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Shares one theme state across a role's screens. Without this, a page that renders *outside*
 * the themed page root — the student player's loading, error and toast surfaces — would hold
 * its own copy of the state and stay light while the page around it went dark.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeContext.Provider value={useLocalThemeMode()}>{children}</ThemeContext.Provider>
);

/**
 * Returns the active mode and a toggle. Apply `dark` to the page root when the mode is
 * `"dark"`. Uses the shared state from `ThemeProvider` when one is mounted, and falls back to
 * its own state so a screen rendered on its own still themes correctly.
 */
export const useThemeMode = (): ThemeState => {
  const shared = useContext(ThemeContext);
  const standalone = useLocalThemeMode();
  return shared ?? standalone;
};
