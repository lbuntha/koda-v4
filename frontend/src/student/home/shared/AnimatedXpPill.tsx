import React from "react";
import { Zap } from "lucide-react";
import { SvgLibraryAsset } from "../../../assets/SvgLibraryAsset";
import { KID_NAV_ASSET_IDS } from "../kidNavAssets";

interface Props {
  value: number;
}

/** A short reward cue on mount/value change; it never loops or competes with navigation. */
export const AnimatedXpPill: React.FC<Props> = ({ value }) => (
  <span
    key={value}
    className="kid-xp-pill inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full bg-[#F8FAFD] px-2.5 text-[10px] font-black text-[#3F4654] ring-1 ring-[#EDF0F5] sm:px-3 sm:text-xs dark:bg-white/5 dark:text-[#E4DEFF] dark:ring-white/10"
    aria-label={`${value} experience points`}
    title="XP earned"
  >
    <span className="kid-xp-bolt relative z-10 flex h-5 w-5 items-center justify-center drop-shadow-[0_2px_3px_rgba(242,155,24,0.3)]">
      <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.xp} size={20} fallback={<Zap size={14} className="fill-current text-[#FFC928]" />} />
    </span>
    <span className="relative z-10 tabular-nums">{value}</span>
  </span>
);
