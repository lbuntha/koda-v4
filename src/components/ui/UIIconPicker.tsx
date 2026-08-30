import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { svgAssetIds } from "../../assets/svg";
import { ART_ICON_PREFIX, SidebarIcon } from "./sidebarIcon";
import { sidebarIcons } from "./sidebarIcons";
import { themeSystem } from "../../lib/themeSystem";

const FIELD = themeSystem.field("lg", "font-mono");

export interface UIIconPickerProps {
  value: string;
  artIds?: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Shared visual picker for registered icons and Mongo-backed Art SVGs. */
export const UIIconPicker: React.FC<UIIconPickerProps> = ({ value, artIds = [], onSelect, onClose }) => {
  const [tab, setTab] = useState<"icons" | "art">(value.startsWith(ART_ICON_PREFIX) ? "art" : "icons");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const icons = Object.keys(sidebarIcons).filter((name) => !needle || name.includes(needle));
  const arts = [...new Set([...svgAssetIds, ...artIds])].filter((id) => !needle || id.includes(needle));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="icon-picker-title" className="w-full max-w-2xl max-h-[min(680px,calc(100vh-2rem))] overflow-hidden rounded-2xl border-2 border-line bg-surface shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 id="icon-picker-title" className="text-lg font-bold text-ink">Choose menu artwork</h3>
            <p className="text-xs text-muted mt-0.5">Select an interface icon or an SVG from Art.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted hover:text-ink cursor-pointer" aria-label="Close icon picker"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(min(680px,100vh-2rem)-78px)]">
          <div className="flex gap-2 rounded-xl bg-surface-muted p-1">
            {(["icons", "art"] as const).map((nextTab) => (
              <button key={nextTab} type="button" onClick={() => { setTab(nextTab); setQuery(""); }} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer ${tab === nextTab ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-muted"}`}>
                {nextTab === "icons" ? "Interface icons" : "Art / SVG"}
              </button>
            ))}
          </div>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "icons" ? "Search icons" : "Search SVG artwork"} className={`${FIELD} w-full pl-10`} autoFocus /></div>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {tab === "icons" ? icons.map((name) => (
              <button key={name} type="button" onClick={() => onSelect(name)} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 ${value === name ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15" : "border-line"}`}><SidebarIcon name={name} className="w-6 h-6 text-indigo-600 dark:text-indigo-300" /><span className="text-[11px] text-body truncate max-w-full">{name}</span></button>
            )) : arts.map((id) => (
              <button key={id} type="button" onClick={() => onSelect(`${ART_ICON_PREFIX}${id}`)} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 ${value === `${ART_ICON_PREFIX}${id}` ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15" : "border-line"}`}><span className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center p-1"><SidebarIcon name={`${ART_ICON_PREFIX}${id}`} size="100%" className="w-10 h-10" /></span><span className="text-[11px] text-body truncate max-w-full">{id}</span></button>
            ))}
          </div>
          {((tab === "icons" && !icons.length) || (tab === "art" && !arts.length)) && <p className="py-8 text-center text-sm text-muted">No artwork matches your search.</p>}
        </div>
      </div>
    </div>
  );
};
