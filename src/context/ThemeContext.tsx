import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { PreferencesAPI, type ThemeMode } from "../lib/preferences";

export type { ThemeMode };

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

/**
 * Paints the document with whatever theme the family's preferences hold.
 *
 * The choice itself is not kept here any more — it is one field of the synced
 * preferences document, so a parent switching to dark on their laptop switches
 * the tablet too. This provider is left with the one job the store cannot do:
 * putting the class on `<html>`.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useSyncExternalStore(PreferencesAPI.subscribe, PreferencesAPI.version, PreferencesAPI.version);
  const theme = PreferencesAPI.current().theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("theme-light");
      root.classList.remove("theme-dark");
      root.classList.remove("dark");
    } else {
      root.classList.add("theme-dark");
      root.classList.add("dark");
      root.classList.remove("theme-light");
    }
  }, [theme]);

  const setTheme = (next: ThemeMode) => PreferencesAPI.update({ theme: next });
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
