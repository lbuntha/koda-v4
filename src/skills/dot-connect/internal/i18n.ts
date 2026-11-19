import { skillLocales } from "../../kit/i18n";

/**
 * Dot Connect's own words — `../locales/en.json`, `../locales/km.json`, and any
 * other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
export const { t: td } = skillLocales("dot-connect");

/** Dots carry A, B, C… so colour is never the only way to tell a pair. */
export const LETTERS = "ABCDEFGH";
export const letterOf = (k: number) => LETTERS[k] ?? String(k + 1);
