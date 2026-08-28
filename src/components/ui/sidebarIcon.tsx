import React from "react";
import { SvgAsset } from "../../assets/svg";
import { resolveSidebarIcon } from "./sidebarIcons";

export const ART_ICON_PREFIX = "art:";

export const artIconId = (value?: string): string | null =>
  value?.startsWith(ART_ICON_PREFIX) ? value.slice(ART_ICON_PREFIX.length) : null;

/** Renders either a registered Lucide icon or an SVG from the shared Art library. */
export const SidebarIcon: React.FC<{ name?: string; className?: string; size?: number | string }> = ({ name, className, size = 20 }) => {
  const assetId = artIconId(name);
  if (assetId) {
    return <SvgAsset id={assetId} size={size} className={className} fallback={<span className={className} />} />;
  }
  const Icon = resolveSidebarIcon(name);
  return <Icon className={className} />;
};
