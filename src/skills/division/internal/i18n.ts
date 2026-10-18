import type { TranslateVars } from "../../../lib/i18n";
import { skillLocales } from "../../kit/i18n";

/**
 * Division's own words — `../locales/en.json`, `../locales/km.json`, and any
 * other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
const locales = skillLocales("division");
export const { listAnd } = locales;

/**
 * One of division's lines, in the language on screen.
 *
 * Numbers go in as written digits, never grouped: a dividend is "1234" in the
 * sum on screen, so it is "1234" in the sentence about it too. `count` stays a
 * number, because a plural set picks its form by it.
 */
export const td = (key: string, vars?: TranslateVars): string =>
  locales.t(
    key,
    vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "number" && k !== "count" ? String(v) : v])),
  );

/**
 * A fixed table of lines — a refusal for each reason — read from the catalog
 * each time a line is looked up, so it follows the language on screen. The
 * keys are the table's own; the lines live under `<section>.<key>`.
 */
export function catalogRecord<K extends string>(section: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    Object.defineProperty(out, key, { enumerable: true, get: () => td(`${section}.${key}`) });
  }
  return out;
}
