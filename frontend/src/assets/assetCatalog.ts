/**
 * Every picture an author can choose, in one list.
 *
 * Four vocabularies grew up separately: the eleven drawable shapes in `Assets.tsx`, the six
 * emoji in `types.ts`, the forty Goods Sort sprites in `goods-sort/`, and the account's own
 * SVG library in Mongo. Only the first three were ever hardcoded into pickers, and each
 * picker hardcoded a different subset — which is why the forty sprites, the largest set of
 * artwork in the product, could not be used by any activity except Goods Sort and Liquid Sort.
 *
 * This module is the single source: one id scheme, one category list, one lookup. Pickers
 * render whatever it returns and `CountingAsset` draws whatever id it is handed.
 *
 * ## The id scheme
 *
 * An id is what a question stores, in `objectId` and `config.assetType`. Shapes and emoji keep
 * the bare ids they have always been stored as (`"apple"`, `"duck"`) — thousands of published
 * questions use them and renaming would orphan every one. Sprites are new to questions, so
 * they take a namespaced `goods:` id, which cannot collide with a shape id even though several
 * names ("apple", "star", "car") exist in both sets.
 */

import { GOODS_ASSET_KEYS } from "./goods-sort/GoodsAsset";
import { EMOJI_OBJECTS } from "../types";
import type { CountingQuestion, CustomSvgAsset } from "../types";

/**
 * Single source of truth for the built-in drawable vector shapes. The panel dropdowns and the
 * `AssetType` union are both derived from this list, so adding a new shape (plus its `case` in
 * `CountingAsset`'s switch) is the only edit needed for it to appear everywhere.
 *
 * It lives here rather than beside `CountingAsset` so the catalog does not have to import the
 * component that draws it — `Assets.tsx` re-exports it for the callers that already import it
 * from there.
 */
export const ASSET_SHAPES = [
  { type: "apple", label: "Apple", emoji: "🍎" },
  { type: "star", label: "Star", emoji: "⭐" },
  { type: "dino", label: "Dino", emoji: "🦕" },
  { type: "car", label: "Car", emoji: "🚗" },
  { type: "butterfly", label: "Butterfly", emoji: "🦋" },
  { type: "fish", label: "Fish", emoji: "🐟" },
  { type: "rocket", label: "Rocket", emoji: "🚀" },
  { type: "bear", label: "Bear", emoji: "🧸" },
  { type: "sun", label: "Sun", emoji: "☀️" },
  { type: "flower", label: "Flower", emoji: "🌸" },
  { type: "heart", label: "Heart", emoji: "❤️" },
] as const;

export type ShapeAssetType = (typeof ASSET_SHAPES)[number]["type"];

export type AssetKind = "shape" | "sprite" | "emoji" | "custom";

export type AssetCategory =
  | "Shapes" | "Bottles" | "Snacks" | "Toys" | "Objects" | "Badges" | "Emoji" | "Custom";

export interface CatalogAsset {
  /** What a question stores, in `objectId` and `config.assetType`. */
  id: string;
  label: string;
  kind: AssetKind;
  category: AssetCategory;
  /** The character to draw, for `kind: "emoji"` only. */
  emoji?: string;
}

/** Namespace for Goods Sort sprite ids. See "The id scheme" above. */
const SPRITE_PREFIX = "goods:";

export const spriteId = (key: string): string => `${SPRITE_PREFIX}${key}`;
export const isSpriteId = (id: string): id is `goods:${string}` => id.startsWith(SPRITE_PREFIX);
/** The sprite-sheet key behind a `goods:` id — what `GoodsAsset` takes as its `typeKey`. */
export const spriteKey = (id: string): string => id.slice(SPRITE_PREFIX.length);

/**
 * Which shelf each sprite belongs on. Previously copy-pasted into `SvgAssetEditor` and
 * `AssetSelectionModal`, which meant adding a sprite required remembering both.
 */
const SPRITE_CATEGORIES: Record<string, Exclude<AssetCategory, "Shapes" | "Emoji" | "Custom">> = {
  Bottles: ["bottle_water", "bottle_juice", "bottle_soda", "bottle_potion", "bottle_milk", "bottle_boba", "bottle_honey", "bottle_energy"],
  Snacks: ["chips", "cola", "milk", "donut", "popsicle", "apple", "burger", "pizza", "icecream", "cookie", "candy"],
  Toys: ["teddy", "duck", "car", "robot", "ball", "controller", "rocket"],
  Objects: ["plant", "clock", "pencil", "book", "guitar", "camera", "key"],
  Badges: ["gem", "crown", "star", "gift", "palette", "trophy", "diamond"],
} as unknown as Record<string, Exclude<AssetCategory, "Shapes" | "Emoji" | "Custom">>;

const categoryOfSprite = (key: string): AssetCategory => {
  for (const [category, keys] of Object.entries(SPRITE_CATEGORIES)) {
    if ((keys as unknown as string[]).includes(key)) return category as AssetCategory;
  }
  return "Objects";
};

const titleCase = (key: string): string =>
  key.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

/** The eleven drawable vector shapes, ids unchanged from what questions already store. */
export const SHAPE_ASSETS: CatalogAsset[] = ASSET_SHAPES.map((shape) => ({
  id: shape.type,
  label: shape.label,
  kind: "shape",
  category: "Shapes",
}));

/** The forty Goods Sort sprites, namespaced so "apple" the sprite ≠ "apple" the shape. */
export const SPRITE_ASSETS: CatalogAsset[] = GOODS_ASSET_KEYS.map((key) => ({
  id: spriteId(key),
  label: titleCase(key),
  kind: "sprite",
  category: categoryOfSprite(key),
}));

export const EMOJI_ASSETS: CatalogAsset[] = EMOJI_OBJECTS.map((item) => ({
  id: item.id,
  label: item.label,
  kind: "emoji",
  category: "Emoji",
  emoji: item.emoji,
}));

/** Everything that ships with the app. The account's own assets are appended per-viewer. */
export const BUILT_IN_ASSETS: CatalogAsset[] = [...SHAPE_ASSETS, ...SPRITE_ASSETS, ...EMOJI_ASSETS];

const BY_ID = new Map(BUILT_IN_ASSETS.map((asset) => [asset.id, asset]));

/** A library asset as a catalog entry, so pickers treat custom artwork like everything else. */
export const customAsset = (asset: CustomSvgAsset): CatalogAsset => ({
  id: asset.id,
  label: asset.label || asset.id,
  kind: "custom",
  category: "Custom",
});

/** The whole catalog for one viewer: what ships, plus whatever they have saved. */
export function buildCatalog(customAssets: CustomSvgAsset[] = []): CatalogAsset[] {
  return [...BUILT_IN_ASSETS, ...customAssets.map(customAsset)];
}

/** The catalog entry for a stored id, or `undefined` for artwork this build does not know. */
export function findAsset(id: string, customAssets: CustomSvgAsset[] = []): CatalogAsset | undefined {
  const builtIn = BY_ID.get(id);
  if (builtIn) return builtIn;
  const custom = customAssets.find((candidate) => candidate.id === id);
  return custom ? customAsset(custom) : undefined;
}

/**
 * The fields a question needs to draw this asset, ready to merge into its config.
 *
 * Selection used to be written out by hand at each picker, and they disagreed: one set
 * `assetType` and not `objectId`, another wrote four fields where one would do. Every picker
 * now applies this instead.
 */
export function assetSelection(asset: CatalogAsset): {
  objectId: string;
  assetType: string;
  customSvgAssetId?: string;
  emoji?: string;
} {
  if (asset.kind === "custom") {
    // `custom_svg` is the drawing mode; the id is the reference — see `assetRef.ts`.
    return { objectId: "custom_svg", assetType: "custom_svg", customSvgAssetId: asset.id };
  }
  if (asset.kind === "emoji") {
    return { objectId: asset.id, assetType: "emoji", emoji: asset.emoji };
  }
  return { objectId: asset.id, assetType: asset.id };
}

/**
 * A question patch that switches it to this asset.
 *
 * Clearing the three snapshot fields matters: re-picking artwork on a question authored before
 * references existed would otherwise leave its old inlined copy behind, and `resolveAssetRef`
 * falls back to that copy whenever the referenced asset cannot be found.
 */
export function assetQuestionPatch(
  config: CountingQuestion["config"],
  asset: CatalogAsset,
): { objectId: string; config: CountingQuestion["config"] } {
  const selection = assetSelection(asset);
  return {
    objectId: selection.objectId,
    config: {
      ...config,
      assetType: selection.assetType,
      customSvgAssetId: selection.customSvgAssetId,
      customSvgMarkup: undefined,
      customSvgLabel: undefined,
      customSvgScale: undefined,
    },
  };
}

/** Category tabs in display order, with the count each would show. */
export function categoryCounts(catalog: CatalogAsset[]): Array<{ category: AssetCategory; count: number }> {
  const order: AssetCategory[] = ["Shapes", "Bottles", "Snacks", "Toys", "Objects", "Badges", "Emoji", "Custom"];
  return order.map((category) => ({
    category,
    count: catalog.filter((asset) => asset.category === category).length,
  }));
}

/** Case-insensitive match on label and id, so "bottle" finds `goods:bottle_boba`. */
export function searchCatalog(catalog: CatalogAsset[], query: string): CatalogAsset[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return catalog;
  return catalog.filter(
    (asset) => asset.label.toLowerCase().includes(needle) || asset.id.toLowerCase().includes(needle),
  );
}
