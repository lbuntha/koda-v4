import React from "react";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { useAsset } from "../assets/questionAsset";
import { isSpriteId, spriteKey, type ShapeAssetType } from "../assets/assetCatalog";
import { GoodsAsset } from "../assets/goods-sort/GoodsAsset";
import { sanitizeSvgMarkup } from "../assets/svgSafety";
import { scopeSvgIds } from "../assets/svgIds";
import { BuiltinShapeAsset } from "../assets/BuiltinShapeAsset";

// Defined in the catalog so it can list every shape without importing this component.
export { ASSET_SHAPES, type ShapeAssetType } from "../assets/assetCatalog";

/**
 * `goods:${string}` covers the Goods Sort sprite ids — see `assetCatalog.ts`. Widening the
 * union is what lets any activity, not just Goods Sort, draw that artwork.
 */
export type AssetType = "emoji" | ShapeAssetType | "custom_svg" | `goods:${string}`;

interface AssetProps {
  type: AssetType;
  emoji?: string;
  size?: number;
  className?: string;
  /**
   * Which library asset to draw for `custom_svg`. Omit it inside a `QuestionAssetProvider`
   * and the active question's own choice is drawn — which is how the canvases work, since
   * they render whatever the question picked without ever naming it.
   */
  assetId?: string;
  /** @deprecated Inline markup. For pre-reference content and for callers already holding markup. */
  customSvgMarkup?: string;
  scale?: number;
}

export const CountingAsset: React.FC<AssetProps> = ({ type, emoji, size = 48, className = "", assetId, customSvgMarkup, scale }) => {
  const svgScope = React.useId();
  const { overrides } = useSvgLibrary();
  const custom = useAsset(assetId, customSvgMarkup);

  // Both artwork paths below inject markup as HTML, so both scope and sanitize it first.
  // Memoized because a counting canvas draws dozens of these and re-runs on every drag frame.
  const override = type !== "emoji" && type !== "custom_svg" && !isSpriteId(type)
    ? overrides[type]
    : undefined;
  const rawMarkup = type === "custom_svg" ? custom?.markup : override?.markup;
  const safeMarkup = React.useMemo(
    () => (rawMarkup ? scopeSvgIds(sanitizeSvgMarkup(rawMarkup), svgScope) : ""),
    [rawMarkup, svgScope],
  );

  // Built-in shapes automatically consume the account's shared Mongo-backed override.
  if (override && safeMarkup) {
    const activeScale = scale !== undefined ? scale : (override.scale !== undefined ? override.scale : 1.0);
    const finalSize = size * activeScale;
    return (
      <div
        className={`custom-svg-container flex items-center justify-center pointer-events-none select-none ${className}`}
        style={{ width: `${finalSize}px`, height: `${finalSize}px` }}
        dangerouslySetInnerHTML={{ __html: safeMarkup }}
      />
    );
  }

  if (type === "custom_svg") {
    if (!custom || !safeMarkup) return null;
    const activeScale = scale !== undefined ? scale : custom.scale;
    const finalSize = size * activeScale;
    return (
      <div
        className={`custom-svg-container flex items-center justify-center pointer-events-none select-none ${className}`}
        style={{ width: `${finalSize}px`, height: `${finalSize}px` }}
        dangerouslySetInnerHTML={{ __html: safeMarkup }}
      />
    );
  }

  // Goods Sort artwork, drawn by the same component Goods Sort uses, so the geometry stays
  // defined once. Needs `GoodsAssetLibrary` mounted — `main.tsx` does it app-wide.
  if (isSpriteId(type)) {
    return <GoodsAsset typeKey={spriteKey(type)} size={size * (scale ?? 1)} className={className} />;
  }

  if (type === "emoji") {
    const isAlphanumeric = emoji && /^[a-zA-Z0-9\s\-+*/=?]+$/.test(emoji);
    if (isAlphanumeric) {
      return (
        <div 
          className={`flex items-center justify-center font-black rounded-2xl shadow-sm border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-950 transition-all text-center select-none pointer-events-none ${className}`}
          style={{ 
            width: `${size}px`, 
            height: `${size}px`, 
            fontSize: emoji.length > 2 ? `${size * 0.38}px` : `${size * 0.48}px`,
            fontFamily: "'Outfit', 'Inter', sans-serif",
            lineHeight: 1
          }}
        >
          {emoji}
        </div>
      );
    }

    return (
      <span 
        className={`select-none pointer-events-none leading-none ${className}`}
        style={{ fontSize: `${size * 0.8}px` }}
      >
        {emoji || "🍎"}
      </span>
    );
  }

  return <BuiltinShapeAsset type={type} size={size} className={className} />;
};
