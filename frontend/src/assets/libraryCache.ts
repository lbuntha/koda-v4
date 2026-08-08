/**
 * Per-account local cache of the SVG library, and the rule for when it may be written back.
 *
 * This exists as its own module because getting it wrong loses user work silently. A studio
 * session that fails to *read* the library used to carry on and *write* anyway, pushing
 * whatever it had cached — including an empty thumbnail map it had never populated — over the
 * account's real library, while reporting "Saved".
 */

import type { SvgOverride } from "../api/svgAssets";
import type { CustomSvgAsset } from "../types";

export interface CachedLibrary {
  assets: CustomSvgAsset[];
  overrides: Record<string, SvgOverride>;
  deletedSystemAssetIds: string[];
  /** Counting technique -> SVG asset id. */
  techniqueThumbnails: Record<string, string>;
  /** Mastery level -> SVG asset id. */
  masteryGateAssets: Partial<Record<"beginner" | "developing" | "proficient" | "master", string>>;
}

export const ASSETS_KEY = "koda_custom_svg_assets";
export const OVERRIDES_KEY = "koda_svg_overrides";
export const THUMBNAILS_KEY = "koda_technique_thumbnails";
export const MASTERY_GATE_ASSETS_KEY = "koda_mastery_gate_assets";
export const DELETED_SYSTEM_ASSETS_KEY = "koda_deleted_system_svg_assets";

/** Keys are per account: two adults sharing a browser must not see each other's library. */
export function accountKey(base: string, ownerId: string): string {
  return `${base}:${ownerId}`;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota or a disabled store. The remote copy is authoritative anyway; losing the cache
    // costs an extra fetch, not data.
    return false;
  }
}

/**
 * Every part of the library, or empty defaults. All three are read together on purpose —
 * restoring assets while leaving thumbnails empty is what made the empty map look authoritative.
 */
export function readCache(ownerId: string): CachedLibrary {
  return {
    assets: readJson<CustomSvgAsset[]>(accountKey(ASSETS_KEY, ownerId), []),
    overrides: readJson<Record<string, SvgOverride>>(accountKey(OVERRIDES_KEY, ownerId), {}),
    deletedSystemAssetIds: readJson<string[]>(accountKey(DELETED_SYSTEM_ASSETS_KEY, ownerId), []),
    techniqueThumbnails: readJson<Record<string, string>>(accountKey(THUMBNAILS_KEY, ownerId), {}),
    masteryGateAssets: readJson<CachedLibrary["masteryGateAssets"]>(accountKey(MASTERY_GATE_ASSETS_KEY, ownerId), {}),
  };
}

export function writeCache(ownerId: string, library: CachedLibrary): void {
  writeJson(accountKey(ASSETS_KEY, ownerId), library.assets);
  writeJson(accountKey(OVERRIDES_KEY, ownerId), library.overrides);
  writeJson(accountKey(DELETED_SYSTEM_ASSETS_KEY, ownerId), library.deletedSystemAssetIds);
  writeJson(accountKey(THUMBNAILS_KEY, ownerId), library.techniqueThumbnails);
  writeJson(accountKey(MASTERY_GATE_ASSETS_KEY, ownerId), library.masteryGateAssets);
}
