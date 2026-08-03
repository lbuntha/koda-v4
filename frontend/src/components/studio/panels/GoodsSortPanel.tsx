/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PanelProps } from "../panelKit";
import {
  GOODS_SORT_LEVELS,
  GOODS_CATALOG,
  PRESET_THEMES,
  getGoodsLevel,
  spareShelves,
  type GoodsDifficultyTier,
} from "../../canvases/goodsSortLevels";
import { Sparkles, RefreshCw, Plus, Check, Palette } from "lucide-react";

/** The curated ladder, in the order it is meant to be climbed. */
const TIER_GROUPS: Array<{ tier: GoodsDifficultyTier; label: string }> = [
  { tier: "beginner", label: "🟢 Beginner — learn the move" },
  { tier: "apprentice", label: "🔵 Apprentice — keep a compartment clear" },
  { tier: "advanced", label: "🟣 Advanced — plan ahead" },
  { tier: "master", label: "🟠 Master — four to a compartment" },
  { tier: "grandmaster", label: "🔴 Grandmaster — the whole store" },
];

export const GoodsSortPanel: React.FC<PanelProps> = ({ question, update }) => {
  const config = (question.config as any) || {};
  const currentLevelId = config.levelId || "level_1";

  const rows = config.gridRows || 3;
  const cols = config.gridCols || 3;
  const capacity = config.compartmentCapacity || 3;
  const selectedTypes: string[] = config.goodsTypes || ["chips", "cola", "milk"];

  const [customEmoji, setCustomEmoji] = useState("");
  const [customLabel, setCustomLabel] = useState("");

  const handleLevelSelect = (levelId: string) => {
    // Check preset themes
    const foundTheme = PRESET_THEMES.find((t) => t.id === levelId);
    if (foundTheme) {
      update({
        targetCount: foundTheme.goodsTypes.length,
        config: {
          ...config,
          levelId: foundTheme.id,
          gridRows: foundTheme.rows,
          gridCols: foundTheme.cols,
          compartmentCapacity: foundTheme.compartmentCapacity,
          goodsTypes: foundTheme.goodsTypes,
        },
      });
      return;
    }

    if (levelId === "custom") {
      update({
        config: {
          ...config,
          levelId: "custom",
          gridRows: rows,
          gridCols: cols,
          compartmentCapacity: capacity,
          goodsTypes: selectedTypes,
        },
      });
      return;
    }

    // Default curriculum levels
    const level = getGoodsLevel(levelId);
    update({
      targetCount: level.targetCount,
      config: {
        ...config,
        levelId: level.id,
        gridRows: level.rows,
        gridCols: level.cols,
        compartmentCapacity: level.compartmentCapacity,
        goodsTypes: undefined,
      },
    });
  };

  const toggleGoodsType = (key: string) => {
    let nextTypes = selectedTypes.includes(key)
      ? selectedTypes.filter((t) => t !== key)
      : [...selectedTypes, key];

    if (nextTypes.length === 0) {
      nextTypes = ["chips"];
    }

    update({
      targetCount: nextTypes.length,
      config: {
        ...config,
        goodsTypes: nextTypes,
        gridRows: rows,
        gridCols: cols,
        compartmentCapacity: capacity,
      },
    });
  };

  const handleAddCustomGood = () => {
    if (!customEmoji.trim()) return;
    const typeKey = `custom_${customEmoji.trim()}_${Date.now()}`;
    const newCustomGood = {
      typeKey,
      label: customLabel.trim() || `Item ${customEmoji}`,
      emoji: customEmoji.trim(),
      color: "#6366F1",
    };

    const nextCustomGoods = [...(config.customGoods || []), newCustomGood];
    const nextTypes = [...selectedTypes, typeKey];

    update({
      targetCount: nextTypes.length,
      config: {
        ...config,
        goodsTypes: nextTypes,
        customGoods: nextCustomGoods,
        gridRows: rows,
        gridCols: cols,
        compartmentCapacity: capacity,
      },
    });

    setCustomEmoji("");
    setCustomLabel("");
  };

  const handleGridChange = (newRows: number, newCols: number) => {
    update({
      config: {
        ...config,
        gridRows: newRows,
        gridCols: newCols,
        goodsTypes: selectedTypes,
        compartmentCapacity: capacity,
      },
    });
  };

  const handleCapacityChange = (newCap: number) => {
    update({
      config: {
        ...config,
        compartmentCapacity: newCap,
        goodsTypes: selectedTypes,
        gridRows: rows,
        gridCols: cols,
      },
    });
  };

  const handleRegenerate = () => {
    update({
      config: {
        ...config,
        seed: Date.now(),
        goodsTypes: selectedTypes,
        gridRows: rows,
        gridCols: cols,
        compartmentCapacity: capacity,
      },
    });
  };

  const selectedLevel = getGoodsLevel(currentLevelId, config);

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden text-slate-800 dark:text-slate-100">
      {/* ── Mode & Preset Theme Selection ── */}
      <div>
        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">
          Preset Theme & Level
        </label>
        <select
          value={currentLevelId}
          onChange={(e) => handleLevelSelect(e.target.value)}
          className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 truncate"
        >
          <optgroup label="✨ Pre-Configured Themes (Fully Customizable)">
            {PRESET_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.emoji} {theme.name} ({theme.rows}x{theme.cols})
              </option>
            ))}
          </optgroup>
          {/* Grouped by tier rather than listed flat: thirty levels in one list is a
              wall, and the tier is the thing an author is actually choosing between. */}
          {TIER_GROUPS.map(({ tier, label }) => {
            const levels = GOODS_SORT_LEVELS.filter((lvl) => lvl.difficultyTier === tier);
            if (!levels.length) return null;
            return (
              <optgroup key={tier} label={label}>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} — {lvl.targetCount} kinds, {lvl.rows}x{lvl.cols}
                  </option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="⚙️ Custom Studio Builder">
            <option value="custom">🛠️ Fully Blank Custom Puzzle</option>
          </optgroup>
        </select>
      </div>

      {/* ── Interactive Customization Controls (Always Editable) ── */}
      <div className="space-y-3.5 p-3 sm:p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl w-full max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" /> Customizable Cabinet Layout
          </span>
          <button
            onClick={handleRegenerate}
            className="px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[10px] font-extrabold flex items-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
          >
            <RefreshCw size={11} /> Shuffle Layout
          </button>
        </div>

        {/* Grid Dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Grid Rows ({rows})
            </label>
            <input
              type="range"
              min={2}
              max={6}
              value={rows}
              onChange={(e) => handleGridChange(Number(e.target.value), cols)}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
              Grid Columns ({cols})
            </label>
            <input
              type="range"
              min={2}
              max={6}
              value={cols}
              onChange={(e) => handleGridChange(rows, Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>
        </div>

        {/* Compartment Capacity */}
        <div>
          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
            Shelf Capacity (Items per Shelf)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCapacityChange(3)}
              className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all truncate ${
                capacity === 3
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              3 Items (Triplets)
            </button>
            <button
              type="button"
              onClick={() => handleCapacityChange(4)}
              className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all truncate ${
                capacity === 4
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              4 Items (Quads)
            </button>
          </div>
        </div>

        {/* Catalog Goods Multi-Select */}
        <div>
          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-2">
            Select Goods to Include ({selectedTypes.length} Types Selected)
          </label>
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.entries(GOODS_CATALOG).map(([key, item]) => {
              const isSelected = selectedTypes.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleGoodsType(key)}
                  className={`relative p-1.5 sm:p-2 rounded-lg border flex flex-col items-center justify-center transition-all min-w-0 ${
                    isSelected
                      ? "bg-indigo-100 dark:bg-indigo-900/60 border-indigo-600 text-indigo-950 dark:text-indigo-100 font-extrabold ring-2 ring-indigo-600"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-sm">
                      <Check size={9} strokeWidth={3} />
                    </div>
                  )}
                  <span className="text-lg sm:text-xl leading-none mb-1">{item.emoji}</span>
                  <span className="text-[9px] font-bold truncate w-full text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SVG Asset Studio Link & Custom Emoji Creator */}
        <div className="pt-2.5 border-t border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
          <div className="flex items-center justify-between p-2 bg-indigo-100/70 dark:bg-indigo-900/50 rounded-lg">
            <span className="text-[11px] font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Palette size={13} className="text-indigo-600 dark:text-indigo-400" /> SVG Asset Studio
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-md">
              32 Gradient SVGs Active
            </span>
          </div>

          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
            Add Custom Emoji Good
          </label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <input
              type="text"
              placeholder="Emoji (🍕)"
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              className="w-16 sm:w-20 text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-center font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-600 outline-none shrink-0"
            />
            <input
              type="text"
              placeholder="Label (Pizza)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="flex-1 min-w-[100px] text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomGood}
              className="w-full sm:w-auto px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Target Summary — what this board asks of a learner, in the ladder's own terms. */}
      <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 truncate">
            Target Sets to Match:
          </span>
          <span className="text-xs font-extrabold uppercase px-2.5 py-1 bg-indigo-600 text-white rounded-md shadow-sm shrink-0">
            {selectedLevel.targetCount} MATCHING SETS
          </span>
        </div>
        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-snug">
          {selectedLevel.teaches}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {selectedLevel.difficultyTier} · {selectedLevel.compartmentCapacity} per compartment ·{" "}
          {spareShelves(selectedLevel)} spare
        </p>
      </div>
    </div>
  );
};
