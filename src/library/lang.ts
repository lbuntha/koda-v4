/**
 * The book language this device reads in — its own module so Home can ask
 * without loading the Library page.
 */

import type { Language } from "./data/passage";

export const LANG_KEY = "koda_library_lang_v1";

export function readLang(): Language {
  try {
    return localStorage.getItem(LANG_KEY) === "km" ? "km" : "en";
  } catch {
    return "en";
  }
}
