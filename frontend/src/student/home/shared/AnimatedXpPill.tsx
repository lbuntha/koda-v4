import React from "react";
import { Zap } from "lucide-react";
import { SvgLibraryAsset } from "../../../assets/SvgLibraryAsset";
import { KID_NAV_ASSET_IDS } from "../kidNavAssets";

interface Props {
  value: number;
}

const compactUnit = (value: number, divisor: number, suffix: string): string => {
  const rounded = Math.round((value / divisor) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}${suffix}`;
};

/** Compact visual label; assistive text and the tooltip continue to expose the exact total. */
export const formatCompactXp = (value: number): string => {
  const safeValue = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (safeValue >= 1_000_000) return compactUnit(safeValue, 1_000_000, "m");
  if (safeValue >= 1_000) return compactUnit(safeValue, 1_000, "k");
  return String(safeValue);
};

/** A short reward cue on mount/value change; it never loops or competes with navigation. */
export const AnimatedXpPill: React.FC<Props> = ({ value }) => {
  const exactValue = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return (
    <span
      key={exactValue}
      className="kid-xp-pill inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full border-2 border-[#ECEEF3] bg-white px-2.5 text-[10px] font-black text-[#3F4654] shadow-[0_3px_0_#ECEEF3] sm:px-3 sm:text-xs dark:border-white/10 dark:bg-white/5 dark:text-[#E4DEFF] dark:shadow-[0_3px_0_#23263A]"
      aria-label={`${exactValue} experience points`}
      title={`${exactValue.toLocaleString()} XP earned`}
    >
      <span className="kid-xp-bolt relative z-10 flex h-5 w-5 items-center justify-center drop-shadow-[0_2px_3px_rgba(242,155,24,0.3)]">
        <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.xp} size={20} fallback={<Zap size={14} className="fill-current text-[#FFC928]" />} />
      </span>
      <span className="relative z-10 tabular-nums">{formatCompactXp(exactValue)}</span>
    </span>
  );
};
