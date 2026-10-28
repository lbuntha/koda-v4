import type { TranslateVars } from "../../../lib/i18n";
import { skillLocales } from "../../kit/i18n";

/**
 * Fractions' own words — `../locales/en.json`, `../locales/km.json`, and any
 * other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
const locales = skillLocales("fractions");

/**
 * One of fractions' lines, in the language on screen.
 *
 * Numbers go in as written digits, never grouped. `count` stays a number,
 * because a plural set picks its form by it.
 */
export const tf = (key: string, vars?: TranslateVars): string =>
  locales.t(
    key,
    vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "number" && k !== "count" ? String(v) : v])),
  );

/** A fixed table of lines, read from the catalog each time one is looked up. */
export function catalogRecord<K extends string>(section: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(out, key, { enumerable: true, get: () => tf(`${section}.${key}`) });
  }
  return out;
}

/** "a and b and c", joined the way the language on screen joins a list. */
export const joinAnd = (items: string[]): string =>
  items.length === 0 ? "" : items.reduce((a, b) => tf("and", { a, b }));
