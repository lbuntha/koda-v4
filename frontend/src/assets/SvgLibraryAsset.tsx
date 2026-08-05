import React from "react";
import { CountingAsset } from "../components/Assets";
import { useOptionalSvgLibrary } from "./SvgLibraryContext";

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
  const library = useOptionalSvgLibrary();
  const assets = library?.assets ?? [];
  const asset = assets.find((candidate) => candidate.id === assetId);

  if (!asset) return <>{fallback}</>;

  return (
    <span title={asset.label} className="inline-flex">
      {/* By id, not markup — one resolver for every asset. See `assets/assetRef.ts`. */}
      <CountingAsset type="custom_svg" assetId={asset.id} size={size} className={className} />
    </span>
  );
};
