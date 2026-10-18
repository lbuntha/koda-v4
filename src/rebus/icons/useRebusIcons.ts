/**
 * The drawings Rebus Rush can show, as they are right now.
 *
 * A drawing is built into the app (`library.ts`), and the Art library can
 * override it or add to it: an SVG filed there as `rebus-honey` wins over the
 * built-in one, on every device, the way an edited Library picture does. So a
 * drawing that does not look good is fixed in the Rebus Studio, with no
 * release, and what a child sees changes the next time their device syncs the
 * art library.
 *
 * Order, as `SvgAsset` resolves it: this family's art, then the shared art
 * library, then the built-in drawing.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { SharedArtStore } from "../../lib/sharedArtStore";
import { ArtStore } from "../../lib/sync/artStore";
import { ICON_ART, ICON_PREFIX } from "./library";

/** The art library category Rebus drawings are filed under. */
export const REBUS_ART_CATEGORY = "rebus";

/** A built-in drawing as a complete SVG, the form the Art library stores. */
export const bundledSvg = (name: string): string | null => {
  const inner = ICON_ART[name];
  return inner === undefined ? null : `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
};

export interface RebusIcon {
  /** `rebus-honey`. */
  id: string;
  /** `honey`. */
  name: string;
  /** What is drawn now: the Art library's version if there is one, else the built-in. */
  markup: string;
  /** The Art library has a version of this drawing. */
  inArt: boolean;
  /** There is a built-in version, so the Art library's can be reset to it. */
  builtIn: boolean;
}

const subscribeArt = (listener: () => void): (() => void) => {
  const a = ArtStore.subscribe(listener);
  const b = SharedArtStore.subscribe(listener);
  return () => {
    a();
    b();
  };
};
const artVersion = (): string => `${ArtStore.version()}.${SharedArtStore.version()}`;

/** The Art library's SVG for an id, or undefined. */
export const artMarkupFor = (id: string): string | undefined => ArtStore.get(id)?.markup ?? SharedArtStore.get(id)?.markup;

/** Subscribes to the Art stores and makes sure they are loaded. */
const useArtStores = (): string => {
  const v = useSyncExternalStore(subscribeArt, artVersion, artVersion);
  useEffect(() => {
    void ArtStore.load();
    void SharedArtStore.load();
  }, []);
  return v;
};

/** What is drawn for one icon id, or null when nothing is (so the piece shows its name). */
export const useIconMarkup = (id: string): string | null => {
  const v = useArtStores();
  return useMemo(() => artMarkupFor(id) ?? bundledSvg(id.startsWith(ICON_PREFIX) ? id.slice(ICON_PREFIX.length) : id), [id, v]);
};

/** Every drawing, built-in or added through the Art library, sorted by name. */
export const useRebusIcons = (): RebusIcon[] => {
  const v = useArtStores();
  return useMemo(() => {
    const names = new Set(Object.keys(ICON_ART));
    for (const asset of [...SharedArtStore.all(), ...ArtStore.all().values()]) if (asset.id.startsWith(ICON_PREFIX)) names.add(asset.id.slice(ICON_PREFIX.length));
    return [...names].sort().map((name): RebusIcon => {
      const id = ICON_PREFIX + name;
      const art = artMarkupFor(id);
      const built = bundledSvg(name);
      return { id, name, markup: art ?? built ?? "", inArt: art !== undefined, builtIn: built !== null };
    });
  }, [v]);
};
