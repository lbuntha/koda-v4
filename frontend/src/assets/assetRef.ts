/**
 * Turning a question's artwork *reference* into the artwork to draw.
 *
 * A question names the library asset it wants (`config.customSvgAssetId`) and stops there. It
 * does not carry a copy of the markup, so editing an asset in the SVG Library changes every
 * question drawing it, with nothing to rewrite. Questions authored before this rule inlined a
 * snapshot instead, and those copies are still the only record for that content — hence the
 * legacy branch below, which is read but never written.
 */

import type { CustomSvgAsset } from "../types";

/**
 * The artwork fields of a question's `config`. Every field is optional, so a whole
 * `CountingQuestion["config"]` satisfies it — callers pass the config straight in.
 */
export interface AssetRef {
  /** The library asset to draw. The only field newly authored questions write. */
  customSvgAssetId?: string;
  /** @deprecated Inlined snapshot from before assets were referenced by id. Read, never written. */
  customSvgMarkup?: string;
  /** @deprecated Snapshot of the asset's label. See `customSvgMarkup`. */
  customSvgLabel?: string;
  /** @deprecated Snapshot of the asset's scale. See `customSvgMarkup`. */
  customSvgScale?: number;
}

export interface ResolvedAsset {
  markup: string;
  label: string;
  scale: number;
}

/** True when this reference names artwork at all, rather than an emoji or a built-in shape. */
export function hasAssetRef(ref: AssetRef | null | undefined): boolean {
  return Boolean(ref && (ref.customSvgAssetId || ref.customSvgMarkup));
}

/**
 * The artwork a reference points at, or `null` when it points at nothing.
 *
 * The library wins over an inlined snapshot, so a question carrying both — one authored before
 * the reference rule and re-picked since — follows the asset as it is edited rather than the
 * copy frozen into it. An id naming an asset that has since been deleted falls back to the
 * snapshot if it has one, which is the only way that question still draws anything.
 */
export function resolveAssetRef(
  ref: AssetRef | null | undefined,
  assets: CustomSvgAsset[],
): ResolvedAsset | null {
  if (!ref) return null;

  if (ref.customSvgAssetId) {
    const asset = assets.find((candidate) => candidate.id === ref.customSvgAssetId);
    if (asset && asset.markup) {
      return { markup: asset.markup, label: asset.label || asset.id, scale: asset.scale ?? 1 };
    }
  }

  if (ref.customSvgMarkup) {
    return {
      markup: ref.customSvgMarkup,
      label: ref.customSvgLabel || "Custom Shape",
      scale: ref.customSvgScale ?? 1,
    };
  }

  return null;
}
