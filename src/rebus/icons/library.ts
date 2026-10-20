/**
 * Every icon a rebus puzzle can use, by name.
 *
 * Puzzles refer to an icon by id (`rebus-germ`); the artwork lives here, in one
 * place, so the Studio can list what exists and ask an artist for what does
 * not. Adding a drawing is adding a line to one of the themed files.
 */

import { PAL as P, circle, rect } from "./draw";
import { CREATURES } from "./creatures";
import { FOOD } from "./food";
import { NATURE } from "./nature";
import { MORE } from "./more";
import { SPORTS } from "./sports";
import { THINGS } from "./things";

/** A colour as a picture: a rounded tile with a small shine. */
const swatch = (fill: string, outline?: string): string => rect(10, 10, 44, 44, fill, 10, outline) + circle(22, 22, 4, P.white).replace("<circle", '<circle opacity=".5"');

export const ICON_ART: Readonly<Record<string, string>> = {
  ...NATURE,
  ...FOOD,
  ...CREATURES,
  ...THINGS,
  ...SPORTS,
  ...MORE,
  blue: swatch(P.blue),
  green: swatch(P.green),
  black: swatch(P.ink),
  white: swatch(P.white, P.soft),
};

export const ICON_PREFIX = "rebus-";

/** Every id the library can draw, for the Studio's missing-icon check. */
export const ICON_IDS: ReadonlySet<string> = new Set(Object.keys(ICON_ART).map((name) => ICON_PREFIX + name));

/** The markup for an icon id, or null when it has no drawing yet. */
export const iconArt = (id: string): string | null => ICON_ART[id.startsWith(ICON_PREFIX) ? id.slice(ICON_PREFIX.length) : id] ?? null;
