import { skillLocales } from "../../kit/i18n";
import type { PredefinedAsset } from "./data/countingAssets";

/**
 * Counting's own words — `../locales/en.json`, `../locales/km.json`, and any
 * other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
export const { t: tc, listAnd } = skillLocales("counting");

/** The asset's name for one of it ("rocket") or several ("rockets"). */
export const thing = (asset: Pick<PredefinedAsset, "key">, form: "one" | "many"): string =>
  tc(`things.${asset.key}.${form}`);
