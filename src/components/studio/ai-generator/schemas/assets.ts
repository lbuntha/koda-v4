/**
 * Shared asset catalogue for AI schemas.
 *
 * Every schema needs "which assets can the AI pick" and "given an objectId,
 * what assetType do I render" — this was copy-pasted per schema before,
 * which meant a bug fix here required editing N files. One source now.
 */

import { SVG_OBJECTS, EMOJI_OBJECTS } from "../../../../types";
import { SchemaAsset, SchemaField } from "./types";

export const VECTOR_ASSETS: SchemaAsset[] = SVG_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "vector" as const,
}));

export const EMOJI_ASSETS: SchemaAsset[] = EMOJI_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "emoji" as const,
}));

export const ALL_ASSETS: SchemaAsset[] = [...VECTOR_ASSETS, ...EMOJI_ASSETS];
export const VALID_ASSET_IDS: string[] = ALL_ASSETS.map(a => a.id);

/** True if the AI's objectId maps to a real asset; canvases fall back visually, but validate() should never emit a dangling id. */
export const isValidAssetId = (id: unknown): id is string =>
  typeof id === "string" && VALID_ASSET_IDS.includes(id);

/** Canvases render vector assets by id and everything else via the emoji renderer keyed off objectId. */
export const resolveAssetType = (objectId: string): string =>
  VECTOR_ASSETS.some(a => a.id === objectId) ? objectId : "emoji";

/** The frameColor enum every "themed container" canvas shares. */
export const FRAME_COLORS = ["indigo", "emerald", "purple", "pink", "rose"] as const;
export type FrameColor = (typeof FRAME_COLORS)[number];

export const resolveFrameColor = (value: unknown, fallback: FrameColor = "indigo"): FrameColor =>
  (FRAME_COLORS as readonly string[]).includes(value as string) ? (value as FrameColor) : fallback;

/** Clamp a raw AI number into [min, max], falling back when it's missing/NaN. */
export const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Shared field builders — 10+ schemas need an identical `assetType` field and
 * 6+ need an identical `frameColor` field. Before this, each schema hand-wrote
 * that block, so a wording tweak meant editing N files and inevitably some
 * drifted. Build the field here once; every schema imports the function.
 */

/** Standard hidden asset-type field: canvases derive this from objectId, never ask the AI. */
export const assetTypeField = (defaultId: string): SchemaField => ({
  key: "assetType",
  label: "Asset Type",
  type: "enum",
  enumValues: [...VALID_ASSET_IDS],
  defaultValue: defaultId,
  description: "The visual asset to render. Derived automatically from objectId by validate().",
  exposeToAI: false,
});

/** Standard themed accent-color field, exposed to the AI with the shared hint. */
export const frameColorField = (defaultColor: FrameColor = "indigo"): SchemaField => ({
  key: "frameColor",
  label: "Frame Color Theme",
  type: "enum",
  enumValues: [...FRAME_COLORS],
  defaultValue: defaultColor,
  description: "Canvas accent color theme.",
  promptHint: "match theme (emerald=nature, purple=space, rose=love)",
});

/**
 * A teacher-facing display toggle the AI never sets — the canvas ships a
 * sensible default and the teacher adjusts it in the Property Studio.
 * Use for things like showItemFrame, showNumbersInSlots, showLayoutRulers.
 */
export const hiddenToggleField = (key: string, label: string, defaultValue: boolean, description: string): SchemaField => ({
  key,
  label,
  type: "boolean",
  defaultValue,
  description,
  exposeToAI: false,
});
