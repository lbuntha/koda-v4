import React from "react";

interface GoodsAssetProps {
  typeKey: string;
  size: number;
  className?: string;
  fallback?: React.ReactNode;
}

export const GOODS_ASSET_KEYS = [
  "chips", "cola", "milk", "donut", "teddy", "duck", "popsicle", "apple",
  "burger", "plant", "clock", "pencil", "gem", "crown", "star", "gift",
  "pizza", "icecream", "cookie", "candy", "car", "robot", "ball", "palette",
  "book", "guitar", "camera", "trophy", "diamond", "key", "rocket", "controller",
  "bottle_water", "bottle_juice", "bottle_soda", "bottle_potion",
  "bottle_milk", "bottle_boba", "bottle_honey", "bottle_energy",
] as const;

const ASSET_KEYS = new Set<string>(GOODS_ASSET_KEYS);

export const hasGradientGoodsAsset = (typeKey: string) => ASSET_KEYS.has(typeKey);

/**
 * A tiny reference into the shared, offline SVG sprite mounted by GoodsAssetLibrary.
 *
 * Product geometry and gradients are deliberately not repeated here. A large board can
 * show more than 70 goods; keeping each instance to one shadow ellipse and one `use`
 * keeps both React reconciliation and Safari SVG painting inexpensive.
 */
const GoodsAssetView: React.FC<GoodsAssetProps> = ({
  typeKey,
  size,
  className = "",
  fallback = null,
}) => {
  if (!hasGradientGoodsAsset(typeKey)) return <>{fallback}</>;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={typeKey}
      data-goods-art={typeKey}
      className={className}
      focusable="false"
    >
      <ellipse cx="32" cy="57.25" rx="18" ry="2.75" fill="#172033" opacity="0.2" />
      <use href={`#goods-${typeKey}`} />
    </svg>
  );
};

export const GoodsAsset = React.memo(
  GoodsAssetView,
  (previous, next) =>
    previous.typeKey === next.typeKey
    && previous.size === next.size
    && previous.className === next.className
    // Catalog goods never render the freshly-created fallback node, so it should not
    // invalidate all shelf artwork whenever the board state changes.
    && (hasGradientGoodsAsset(next.typeKey) || previous.fallback === next.fallback),
);
