/**
 * Supplying canvases with the active question's artwork, and adults' and learners' asset
 * libraries with one lookup path.
 *
 * Most canvases render `<CountingAsset type={assetType} emoji={...} />` with no artwork
 * reference of their own — they draw whatever the active question chose. This used to reach
 * them through `CUSTOM_SVG_OBJECT_PLACEHOLDER`, a module-level object that `App` and
 * `GameLauncher` assigned to from an effect. Two players on one page overwrote each other's
 * artwork, and because an effect runs after paint, the first frame drew the *previous*
 * question's picture. `QuestionAssetProvider` carries the same choice down the tree instead:
 * scoped to one player, and resolved during render.
 *
 * Where the assets themselves come from depends on who is playing. An adult has the live,
 * editable library from `SvgLibraryContext`. A student never loads it — their artwork arrives
 * frozen in the immutable curriculum release, and `PublishedAssetsProvider` supplies that.
 */

import React, { createContext, useContext, useMemo } from "react";
import { useSvgLibrary } from "./SvgLibraryContext";
import { resolveAssetRef, type AssetRef, type ResolvedAsset } from "./assetRef";
import type { CustomSvgAsset } from "../types";

const NO_ASSETS: CustomSvgAsset[] = [];

const PublishedAssetsContext = createContext<CustomSvgAsset[]>(NO_ASSETS);
const QuestionAssetContext = createContext<AssetRef | null>(null);

/** Artwork snapshots delivered with a published release, for learners who have no live library. */
export const PublishedAssetsProvider: React.FC<{
  assets: CustomSvgAsset[] | undefined;
  children: React.ReactNode;
}> = ({ assets, children }) => (
  <PublishedAssetsContext.Provider value={assets ?? NO_ASSETS}>
    {children}
  </PublishedAssetsContext.Provider>
);

/**
 * The artwork the active question chose, for the canvases below that draw it without ever
 * naming it. Pass the question's `config` — only its artwork fields are read.
 */
export const QuestionAssetProvider: React.FC<{
  asset: AssetRef | null | undefined;
  children: React.ReactNode;
}> = ({ asset, children }) => {
  // Keyed on the fields that matter so a canvas subtree does not re-render on every unrelated
  // config edit in the studio — where `config` is a fresh object on each keystroke.
  const ref = useMemo<AssetRef | null>(
    () => (asset ? {
      customSvgAssetId: asset.customSvgAssetId,
      customSvgMarkup: asset.customSvgMarkup,
      customSvgLabel: asset.customSvgLabel,
      customSvgScale: asset.customSvgScale,
    } : null),
    [asset?.customSvgAssetId, asset?.customSvgMarkup, asset?.customSvgLabel, asset?.customSvgScale],
  );

  return <QuestionAssetContext.Provider value={ref}>{children}</QuestionAssetContext.Provider>;
};

/**
 * Every asset this viewer can draw: their own library, plus anything published alongside the
 * release they are playing. An adult's list is the live one; a student's is the frozen one, and
 * in practice only ever one of the two is populated.
 */
export function useAssetLibrary(): CustomSvgAsset[] {
  const { assets } = useSvgLibrary();
  const published = useContext(PublishedAssetsContext);
  return useMemo(
    () => (published.length === 0 ? assets : [...assets, ...published]),
    [assets, published],
  );
}

/**
 * The artwork for an explicit reference, or — given none — whatever the surrounding question
 * chose. `assetId` is how a caller names artwork; `inlineMarkup` only serves pre-reference
 * content and callers passing markup they hold directly, such as a library preview tile.
 */
export function useAsset(assetId?: string, inlineMarkup?: string): ResolvedAsset | null {
  const assets = useAssetLibrary();
  const inherited = useContext(QuestionAssetContext);
  const explicit = assetId || inlineMarkup;
  const ref = explicit
    ? { customSvgAssetId: assetId, customSvgMarkup: inlineMarkup }
    : inherited;

  return useMemo(
    () => resolveAssetRef(ref, assets),
    [ref?.customSvgAssetId, ref?.customSvgMarkup, ref?.customSvgLabel, ref?.customSvgScale, assets],
  );
}

export type { AssetRef, ResolvedAsset };
