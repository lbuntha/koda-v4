import React from "react";
import { CountingAsset } from "../components/Assets";
import { useSvgLibrary } from "./SvgLibraryContext";

interface SvgLibraryAssetProps {
  assetId: string;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

/** Render a Mongo-backed custom SVG by stable asset id from any component. */
export const SvgLibraryAsset: React.FC<SvgLibraryAssetProps> = ({
  assetId,
  size = 48,
  className,
  fallback = null,
}) => {
  const { assets } = useSvgLibrary();
  const asset = assets.find((candidate) => candidate.id === assetId);

  if (!asset) return <>{fallback}</>;

  return (
    <span title={asset.label} className="inline-flex">
      <CountingAsset
        type="custom_svg"
        customSvgMarkup={asset.markup}
        scale={asset.scale}
        size={size}
        className={className}
      />
    </span>
  );
};
