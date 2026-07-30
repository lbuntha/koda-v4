/**
 * Owner-scoped SVG asset persistence. MongoDB is authoritative when the API
 * is configured; callers may keep localStorage as an offline cache.
 */

import { api } from "./client";
import type { CustomSvgAsset } from "../types";

export interface SvgOverride {
  markup: string;
  scale: number;
}

export interface SvgLibraryPayload {
  assets: CustomSvgAsset[];
  overrides: Record<string, SvgOverride>;
  /**
   * Counting technique -> an id in `assets`. Overrides the static artwork a component's
   * manifest ships with. A reference, not markup, so editing the asset updates every
   * technique pointing at it.
   */
  techniqueThumbnails: Record<string, string>;
  revision: number;
}

export interface SvgLibraryResponse extends SvgLibraryPayload {
  exists: boolean;
}

/** Which curriculum skills reference an asset. Keyed by asset id. */
export interface SvgAssetUse {
  curriculumId: string;
  curriculumTitle: string;
  skillId: string;
  skillLabel: string;
}

export const svgAssetsApi = {
  get: () => api.get<SvgLibraryResponse>("/svg-assets"),
  usage: () => api.get<{ usage: Record<string, SvgAssetUse[]> }>("/svg-assets/usage"),
  put: (library: SvgLibraryPayload) => api.put<{ ok: true; revision: number }>("/svg-assets", library),
};
