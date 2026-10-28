import { skillLocales } from "../../kit/i18n";

/**
 * Observation's own words — `../locales/en.json`, `../locales/km.json`, and any
 * other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
export const { t: to } = skillLocales("observation");

/** What the catalog calls an object: "sun hat", never the id. */
export const objectName = (id: string): string => to(`objects.${id}`);

/** A scene's name in the language on screen. */
export const sceneName = (id: string): string => to(`scenes.${id}`);

/** A scene's place ("Castle Kingdom") in the language on screen. */
export const placeName = (place: string): string => to(`places.${place.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`);

/** A search region ("top-left") worded for a sentence: "top left". */
export const regionName = (region: string): string => to(`regions.${region}`);
