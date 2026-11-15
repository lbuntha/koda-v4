import React from "react";
import { SvgAsset, type SvgAssetId } from "../../assets/svg";

/**
 * An icon from the shared art library — the one way pages draw an identity icon.
 *
 * Koda's rule: colourful art (the sidebar's style, `src/assets/svg/kit` and
 * `menu`) for anything that names a thing at 20px or more — section headers,
 * stat tiles, cards, banners. Line icons stay for small controls only (back,
 * close, chevrons). Keeping every identity icon in the art library means one
 * place to find, reuse and restyle them.
 */
export const UIArtIcon: React.FC<{ id: SvgAssetId; className?: string; label?: string }> = ({
  id,
  className = "h-6 w-6",
  label,
}) => (
  <span aria-hidden={label ? undefined : true} className={`inline-block shrink-0 ${className}`}>
    <SvgAsset id={id} size="100%" title={label} untitled fallback={<span />} />
  </span>
);
