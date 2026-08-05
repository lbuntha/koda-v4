/**
 * The one asset picker.
 *
 * Five surfaces used to hand-roll this grid — the Studio's Visual panel, `AssetPicker`,
 * `AssetSelectionModal`, `SvgAssetEditor` and `SkillDetail` — and each hardcoded a different
 * subset of the artwork. That is why the forty Goods Sort sprites appeared only in the Assets
 * tab and the eleven drawable shapes appeared only in the Studio: no screen listed everything,
 * because no list of everything existed. `assetCatalog.ts` is now that list, and this renders it.
 *
 * Selection is by catalog id. What a question stores for that id is `assetSelection`'s business,
 * not the caller's.
 */

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  buildCatalog,
  categoryCounts,
  searchCatalog,
  type AssetCategory,
  type CatalogAsset,
} from "../../assets/assetCatalog";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
import { ASSET_CATEGORY_ICON_IDS } from "../../assets/assetCategoryAssets";
import { SvgLibraryAsset } from "../../assets/SvgLibraryAsset";
import { CountingAsset } from "../Assets";

const CATEGORY_ICONS: Record<Exclude<AssetCategory, "Emoji"> | "All", string> = ASSET_CATEGORY_ICON_IDS;

/** Draws any catalog entry at any size — the tile art, and useful to callers on its own. */
export const CatalogAssetView: React.FC<{ asset: CatalogAsset; size?: number }> = ({
  asset,
  size = 40,
}) => (
  <CountingAsset
    type={asset.kind === "custom" ? "custom_svg" : asset.kind === "emoji" ? "emoji" : (asset.id as any)}
    assetId={asset.kind === "custom" ? asset.id : undefined}
    emoji={asset.emoji}
    size={size}
  />
);

export interface AssetGridProps {
  /** Currently chosen ids. One entry for single-select; several when `multiSelect`. */
  selectedIds: string[];
  onSelect: (asset: CatalogAsset) => void;
  /** Restrict the picker — e.g. a canvas that can only draw vector artwork, not emoji. */
  kinds?: Array<CatalogAsset["kind"]>;
  multiSelect?: boolean;
  /** Shown when the account has saved no custom artwork and the Custom tab is open. */
  emptyCustomHint?: React.ReactNode;
  columns?: number;
  /** Management screens can show names so edit targets are easy to identify. */
  showLabels?: boolean;
  className?: string;
}

export const AssetGrid: React.FC<AssetGridProps> = ({
  selectedIds,
  onSelect,
  kinds,
  multiSelect = false,
  emptyCustomHint,
  columns = 4,
  showLabels = false,
  className = "",
}) => {
  const { assets: customAssets } = useSvgLibrary();
  const [category, setCategory] = useState<AssetCategory | "All">("All");
  const [query, setQuery] = useState("");

  const catalog = useMemo(() => {
    const all = buildCatalog(customAssets);
    return kinds ? all.filter((asset) => kinds.includes(asset.kind)) : all;
  }, [customAssets, kinds]);

  const tabs = useMemo(
    () => categoryCounts(catalog).filter((entry) => entry.count > 0),
    [catalog],
  );

  const visible = useMemo(() => {
    const byCategory = category === "All"
      ? catalog
      : catalog.filter((asset) => asset.category === category);
    return searchCatalog(byCategory, query);
  }, [catalog, category, query]);

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search assets..."
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {[{ category: "All" as const, count: catalog.length }, ...tabs].map((tab) => {
          const isActive = category === tab.category;
          return (
            <button
              key={tab.category}
              type="button"
              onClick={() => setCategory(tab.category)}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-all ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400"
              }`}
            >
              {tab.category === "Emoji" ? (
                <span aria-hidden="true" className="text-sm leading-none">🙂</span>
              ) : (
                <SvgLibraryAsset assetId={CATEGORY_ICONS[tab.category]} size={16} />
              )}
              <span>{tab.category}</span>
              <span className={isActive ? "opacity-80" : "opacity-60"}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/5">
          <p className="text-[10px] font-bold text-slate-500">
            {category === "Custom" ? "No custom SVGs built yet" : "Nothing matches that search"}
          </p>
          {category === "Custom" && emptyCustomHint}
        </div>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {visible.map((asset) => {
            const isSelected = selectedIds.includes(asset.id);
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset)}
                title={asset.label}
                aria-pressed={multiSelect ? isSelected : undefined}
                className={`flex items-center rounded-lg border transition-all cursor-pointer ${showLabels ? "h-14 justify-start gap-2 px-2" : "h-11 justify-center"} ${
                  isSelected
                    ? "scale-105 border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/25 dark:bg-indigo-950/50"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                }`}
              >
                <CatalogAssetView asset={asset} size={showLabels ? 36 : 28} />
                {showLabels && (
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[11px] font-medium text-slate-800 dark:text-slate-100">{asset.label}</span>
                    <span className="block text-[9px] text-slate-400">{asset.kind === "custom" ? "Editable SVG" : asset.category}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
