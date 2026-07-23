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
  revision: number;
}

export interface SvgLibraryResponse extends SvgLibraryPayload {
  exists: boolean;
}

export const svgAssetsApi = {
  get: () => api.get<SvgLibraryResponse>("/svg-assets"),
  put: (library: SvgLibraryPayload) => api.put<{ ok: true; revision: number }>("/svg-assets", library),
};
