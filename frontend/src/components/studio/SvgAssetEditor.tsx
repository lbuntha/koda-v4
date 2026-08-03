/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal SVG Asset Studio & Interactive SVG Editor:
 * Allows authors to inspect, customize, edit gradients/colors/strokes,
 * edit raw SVG source, and export/save SVG assets for Goods Sort and
 * all interactive learning components.
 */

import React, { useState, useMemo } from "react";
import {
  Search,
  Palette,
  Sliders,
  Code,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Package,
  Save,
} from "lucide-react";
import { GOODS_ASSET_KEYS } from "../../assets/goods-sort/GoodsAsset";
import { GoodsAssetLibrary } from "../../assets/goods-sort/GoodsAssetLibrary";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
import type { CustomSvgAsset } from "../../types";
import { Button, Card, Input, Label, Badge } from "../ui";

export type AssetCategoryTab = "goods_sort" | "custom_svg";

export interface SvgStyleConfig {
  primaryColor: string;
  secondaryColor: string;
  gradientAngle: number;
  strokeColor: string;
  strokeWidth: number;
  scale: number;
  shadow: boolean;
  opacity: number;
}

const DEFAULT_STYLE: SvgStyleConfig = {
  primaryColor: "#6844EA",
  secondaryColor: "#9A7CFF",
  gradientAngle: 135,
  strokeColor: "#432DBA",
  strokeWidth: 0,
  scale: 1,
  shadow: true,
  opacity: 1,
};

const PRESET_STYLES: Array<{ name: string; icon: string; config: SvgStyleConfig }> = [
  {
    name: "Vibrant Indigo",
    icon: "🔮",
    config: {
      primaryColor: "#6844EA",
      secondaryColor: "#9A7CFF",
      gradientAngle: 135,
      strokeColor: "#432DBA",
      strokeWidth: 0,
      scale: 1,
      shadow: true,
      opacity: 1,
    },
  },
  {
    name: "Golden Luxe",
    icon: "👑",
    config: {
      primaryColor: "#F59E0B",
      secondaryColor: "#FDE047",
      gradientAngle: 45,
      strokeColor: "#B45309",
      strokeWidth: 1,
      scale: 1.05,
      shadow: true,
      opacity: 1,
    },
  },
  {
    name: "Neon Cyber",
    icon: "⚡",
    config: {
      primaryColor: "#06B6D4",
      secondaryColor: "#EC4899",
      gradientAngle: 90,
      strokeColor: "#0891B2",
      strokeWidth: 2,
      scale: 1,
      shadow: true,
      opacity: 1,
    },
  },
  {
    name: "Pastel Dream",
    icon: "🌸",
    config: {
      primaryColor: "#F472B6",
      secondaryColor: "#A78BFA",
      gradientAngle: 160,
      strokeColor: "#DB2777",
      strokeWidth: 0,
      scale: 1,
      shadow: false,
      opacity: 0.95,
    },
  },
  {
    name: "Emerald Glow",
    icon: "🌿",
    config: {
      primaryColor: "#10B981",
      secondaryColor: "#34D399",
      gradientAngle: 120,
      strokeColor: "#047857",
      strokeWidth: 1,
      scale: 1,
      shadow: true,
      opacity: 1,
    },
  },
];

const GOODS_CATEGORIES: Record<string, string[]> = {
  Snacks: ["chips", "cola", "milk", "donut", "popsicle", "apple", "burger", "pizza", "icecream", "cookie", "candy"],
  Toys: ["teddy", "duck", "car", "robot", "ball", "controller", "rocket"],
  Objects: ["plant", "clock", "pencil", "book", "guitar", "camera", "key"],
  Badges: ["gem", "crown", "star", "gift", "palette", "trophy", "diamond"],
};

export const SvgAssetEditor: React.FC = () => {
  const { assets, setAssets } = useSvgLibrary();
  const [activeTab, setActiveTab] = useState<AssetCategoryTab>("goods_sort");
  const [selectedKey, setSelectedKey] = useState<string>("donut");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [previewSize, setPreviewSize] = useState<number>(64);
  const [style, setStyle] = useState<SvgStyleConfig>(DEFAULT_STYLE);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedSvg, setCopiedSvg] = useState<boolean>(false);

  // Raw SVG Editor state
  const [rawSvg, setRawSvg] = useState<string>(
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">\n  <defs>\n    <linearGradient id="customGrad" x1="0%" y1="0%" x2="100%" y2="100%">\n      <stop offset="0%" stop-color="#6844EA"/>\n      <stop offset="100%" stop-color="#9A7CFF"/>\n    </linearGradient>\n  </defs>\n  <circle cx="50" cy="50" r="40" fill="url(#customGrad)" stroke="#432DBA" stroke-width="4"/>\n</svg>`
  );
  const [customKeyName, setCustomKeyName] = useState<string>("custom_star");
  const [customLabel, setCustomLabel] = useState<string>("Custom Star");
  const [svgError, setSvgError] = useState<string | null>(null);

  const filteredGoodsKeys = useMemo(() => {
    return GOODS_ASSET_KEYS.filter((key) => {
      const matchesSearch = key.toLowerCase().includes(searchQuery.toLowerCase());
      if (selectedCategory === "All") return matchesSearch;
      const categoryKeys = GOODS_CATEGORIES[selectedCategory] || [];
      return matchesSearch && categoryKeys.includes(key);
    });
  }, [searchQuery, selectedCategory]);

  const copyAssetKey = () => {
    navigator.clipboard.writeText(selectedKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copySvgCode = () => {
    const symbolCode = `<use href="#goods-asset-${selectedKey}" width="${previewSize}" height="${previewSize}" />`;
    navigator.clipboard.writeText(symbolCode);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 2000);
  };

  const handleSaveCustomSvg = () => {
    const id = customKeyName.trim();
    if (!id) {
      setSvgError("Please provide a valid key name.");
      return;
    }
    if (!rawSvg.includes("<svg")) {
      setSvgError("SVG source must contain a valid <svg> tag.");
      return;
    }
    setSvgError(null);
    setAssets((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === id);
      const newItem: CustomSvgAsset = { id, label: customLabel.trim() || id, markup: rawSvg, scale: 1 };
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = newItem;
        return next;
      }
      return [...prev, newItem];
    });
  };

  const handleDeleteCustomSvg = (id: string) => {
    setAssets((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#090C1B] dark:text-slate-100 select-none">
      <GoodsAssetLibrary />

      {/* ── Studio Header ── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#11162B]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Palette size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-white">SVG Asset Studio</h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-400">
              Interactive SVG customization &amp; Goods Sort asset editor
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-slate-100 p-1 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("goods_sort")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              activeTab === "goods_sort"
                ? "bg-white text-slate-900 shadow-sm dark:bg-violet-600 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Package size={14} /> Goods Sort Assets ({GOODS_ASSET_KEYS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom_svg")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
              activeTab === "custom_svg"
                ? "bg-white text-slate-900 shadow-sm dark:bg-violet-600 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Code size={14} /> Custom SVG Editor ({assets.length})
          </button>
        </div>
      </header>

      {/* ── Main Studio Layout ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Column: Asset Explorer */}
        <aside className="flex h-full w-full max-w-sm shrink-0 flex-col border-r border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#11162B]">
          {/* Controls Bar */}
          <div className="space-y-2.5 border-b border-slate-200/80 p-3.5 dark:border-white/10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search SVG assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {["All", "Snacks", "Toys", "Objects", "Badges"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all ${
                    selectedCategory === cat
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of Assets */}
          <div className="flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
            {activeTab === "goods_sort" ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filteredGoodsKeys.map((key) => {
                  const isSelected = selectedKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      className={`group relative flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-50/80 shadow-md ring-2 ring-indigo-600/30 dark:border-indigo-400 dark:bg-indigo-950/60"
                          : "border-slate-200/80 bg-white hover:border-indigo-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <svg width="44" height="44" viewBox="0 0 64 64" className="transition-transform group-hover:scale-110">
                        <use href={`#goods-asset-${key}`} width="64" height="64" />
                      </svg>
                      <span className="mt-1.5 truncate text-[10px] font-black text-slate-700 dark:text-slate-300">
                        {key}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {assets.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-slate-400">
                    No custom SVG assets saved yet. Use the editor on the right to create one!
                  </div>
                ) : (
                  assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        setSelectedKey(asset.id);
                        setCustomKeyName(asset.id);
                        setCustomLabel(asset.label);
                        setRawSvg(asset.markup);
                      }}
                      className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer ${
                        selectedKey === asset.id ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50" : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-slate-900 dark:text-white">{asset.label || asset.id}</p>
                        <p className="text-[10px] text-slate-400">{asset.id}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomSvg(asset.id);
                        }}
                        className="text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Center & Right Column: Interactive Editor Workspace */}
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            {/* Live Preview Display Card */}
            <Card className="relative flex flex-col items-center justify-center overflow-hidden border-slate-200/80 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-[#11162B]">
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-black uppercase">
                  Live Studio Preview
                </Badge>
                <span className="text-xs font-bold text-slate-400">({previewSize}px)</span>
              </div>

              {/* Size Controls */}
              <div className="absolute right-4 top-4 flex rounded-xl bg-slate-100 p-1 dark:bg-white/5">
                {[32, 48, 64, 96, 128].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPreviewSize(size)}
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-black transition-all ${
                      previewSize === size ? "bg-white text-slate-900 shadow-sm dark:bg-violet-600 dark:text-white" : "text-slate-400"
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>

              {/* Canvas Render Area */}
              <div className="my-8 flex h-48 w-48 items-center justify-center rounded-3xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)]">
                <div
                  style={{
                    transform: `scale(${style.scale})`,
                    opacity: style.opacity,
                    filter: style.shadow ? "drop-shadow(0 12px 20px rgba(83,74,183,0.25))" : "none",
                    transition: "all 0.2s ease-out",
                  }}
                >
                  {activeTab === "goods_sort" ? (
                    <svg width={previewSize} height={previewSize} viewBox="0 0 64 64">
                      <use href={`#goods-asset-${selectedKey}`} width={previewSize} height={previewSize} />
                    </svg>
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: rawSvg }}
                      className="flex items-center justify-center"
                    />
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                <Button variant="outline" size="sm" onClick={copyAssetKey} className="gap-1.5 text-xs font-extrabold">
                  {copiedKey ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copiedKey ? "Copied Key!" : `Copy Key ("${selectedKey}")`}
                </Button>
                <Button variant="outline" size="sm" onClick={copySvgCode} className="gap-1.5 text-xs font-extrabold">
                  {copiedSvg ? <Check size={14} className="text-emerald-500" /> : <Code size={14} />}
                  {copiedSvg ? "Copied SVG Tag!" : "Copy SVG Symbol"}
                </Button>
              </div>
            </Card>

            {/* Presets Bar */}
            <Card className="border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#11162B]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Color &amp; Theme Presets
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setStyle(DEFAULT_STYLE)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw size={13} /> Reset
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {PRESET_STYLES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setStyle(preset.config)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-2 text-left transition-all hover:border-indigo-500 hover:bg-indigo-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="truncate text-xs font-extrabold text-slate-800 dark:text-white">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Controls Panel */}
            <Card className="space-y-4 border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-[#11162B]">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <Sliders size={16} className="text-indigo-600 dark:text-indigo-400" />
                Live Style &amp; Geometry Modifiers
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Primary Color */}
                <div>
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Primary Color</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={style.primaryColor}
                      onChange={(e) => setStyle({ ...style, primaryColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                    />
                    <Input
                      type="text"
                      value={style.primaryColor}
                      onChange={(e) => setStyle({ ...style, primaryColor: e.target.value })}
                      className="h-9 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Secondary Gradient Color */}
                <div>
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Secondary Gradient</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={style.secondaryColor}
                      onChange={(e) => setStyle({ ...style, secondaryColor: e.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                    />
                    <Input
                      type="text"
                      value={style.secondaryColor}
                      onChange={(e) => setStyle({ ...style, secondaryColor: e.target.value })}
                      className="h-9 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Scale Slider */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>Scale Modifier</span>
                    <span>{style.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.05"
                    value={style.scale}
                    onChange={(e) => setStyle({ ...style, scale: Number(e.target.value) })}
                    className="mt-2 w-full accent-indigo-600"
                  />
                </div>

                {/* Gradient Angle */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>Gradient Angle</span>
                    <span>{style.gradientAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={style.gradientAngle}
                    onChange={(e) => setStyle({ ...style, gradientAngle: Number(e.target.value) })}
                    className="mt-2 w-full accent-indigo-600"
                  />
                </div>
              </div>
            </Card>

            {/* Raw SVG Source Editor */}
            {activeTab === "custom_svg" && (
              <Card className="space-y-4 border-slate-200/80 bg-white p-5 dark:border-white/10 dark:bg-[#11162B]">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                    <Code size={16} className="text-indigo-600 dark:text-indigo-400" />
                    Raw SVG Source &amp; Custom Asset Creator
                  </h3>
                  <Button size="sm" onClick={handleSaveCustomSvg} className="bg-indigo-600 hover:bg-indigo-700">
                    <Save size={14} /> Save to Asset Library
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Asset Key Identifier</Label>
                    <Input
                      type="text"
                      placeholder="e.g. custom_star_v1"
                      value={customKeyName}
                      onChange={(e) => setCustomKeyName(e.target.value)}
                      className="mt-1 h-9 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">Asset Label</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Golden Star"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">SVG XML Markup</Label>
                  <textarea
                    rows={8}
                    value={rawSvg}
                    onChange={(e) => setRawSvg(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-xs text-emerald-400 outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {svgError && <p className="mt-1 text-xs font-bold text-rose-500">{svgError}</p>}
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
