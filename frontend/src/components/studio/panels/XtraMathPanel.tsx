/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * XtraMath Studio Authoring Panel:
 * Clean glass design using Lucide SVG icons (NO emojis).
 * Follows the standard code architecture of Liquid Sort Panel & Goods Sort Panel.
 */

import React from "react";
import { ActorCastField, PanelProps } from "../panelKit";
import { Sparkles, Bot, Palette, Pencil, Zap, Compass, Shield } from "lucide-react";
import { Button, Label, Select, Switch } from "../../ui";
import {
  XTRAMATH_CURRICULUM_LEVELS,
  XTRAMATH_THEMES,
  getXtraMathLevel,
  XtraMathDifficultyTier,
} from "../../canvases/xtraMathLevels";

const TIER_GROUPS: Array<{ tier: XtraMathDifficultyTier; label: string }> = [
  { tier: "beginner", label: "Beginner — Gentle addition & subitizing" },
  { tier: "apprentice", label: "Apprentice — Sums to 10 & 20" },
  { tier: "advanced", label: "Advanced — Multiplication & mixed math" },
  { tier: "master", label: "Master — Times tables & division speed" },
  { tier: "grandmaster", label: "Grandmaster — Rapid-fire flash mental math" },
];

const THEME_ICONS: Record<string, React.ReactElement> = {
  pencil: <Pencil size={14} className="text-indigo-500" />,
  zap: <Zap size={14} className="text-cyan-500" />,
  sparkles: <Sparkles size={14} className="text-pink-500" />,
  compass: <Compass size={14} className="text-blue-500" />,
  shield: <Shield size={14} className="text-emerald-500" />,
};

export const XtraMathPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const config = question.config || {};
  const currentLevelId = config.levelId || "xm_level_1";
  const currentThemeId = config.themeId || "classic";
  const targetCount = question.targetCount || 10;
  const defaultVsComputer = config.defaultVsComputer ?? false;
  const timeLimitSec = config.timeLimitSec || 6;

  const handleLevelSelect = (levelId: string) => {
    if (levelId === "custom") {
      update({
        config: {
          ...config,
          levelId: "custom",
        },
      });
      return;
    }

    const lvl = getXtraMathLevel(levelId);
    update({
      targetCount: lvl.targetCount,
      config: {
        ...config,
        levelId: lvl.id,
        themeId: lvl.themeId || currentThemeId,
        timeLimitSec: lvl.timeLimitSec,
      },
    });
  };

  const handleThemeSelect = (themeId: string) => {
    update({
      config: {
        ...config,
        themeId,
      },
    });
  };

  return (
    <div className="space-y-5 p-4 text-xs font-semibold text-slate-800 dark:text-slate-100">
      {/* Level & Preset Theme Selection Dropdown (Standard Code Pattern) */}
      <div className="space-y-1.5">
        <Label htmlFor="xtramath-level">
          Curriculum Level Preset
        </Label>
        <Select
          id="xtramath-level"
          value={currentLevelId}
          onChange={(e) => handleLevelSelect(e.target.value)}
          className="text-xs font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {TIER_GROUPS.map(({ tier, label }) => {
            const levels = XTRAMATH_CURRICULUM_LEVELS.filter((lvl) => lvl.difficultyTier === tier);
            if (!levels.length) return null;
            return (
              <optgroup key={tier} label={label}>
                {levels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} — {lvl.targetCount} facts, {lvl.timeLimitSec}s limit
                  </option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="Custom Studio Builder">
            <option value="custom">Custom XtraMath Session</option>
          </optgroup>
        </Select>
      </div>

      {/* Preset Theme Selector in Glass Design */}
      <div className="space-y-1.5">
        <Label id="xtramath-theme-label" className="flex items-center gap-1">
          <Palette size={12} className="text-indigo-600 dark:text-indigo-400" /> Preset Visual Theme
        </Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="xtramath-theme-label">
          {XTRAMATH_THEMES.map((theme) => (
            <Button
              type="button"
              variant="outline"
              size="sm"
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              aria-pressed={currentThemeId === theme.id}
              className={`h-auto min-h-11 justify-start px-2.5 py-2 text-left ${
                currentThemeId === theme.id
                  ? "bg-indigo-50 border-indigo-600 text-indigo-950 dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-100 font-extrabold ring-2 ring-indigo-500/20"
                  : "bg-white text-slate-700 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-700"
              }`}
            >
              {THEME_ICONS[theme.iconName] || <Sparkles size={14} />}
              <span className="text-[11px] font-bold truncate">{theme.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Interactive Controls Panel */}
      <div className="space-y-3.5 p-3 sm:p-4 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <Sparkles size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" /> Fluency Session Rules
          </span>
        </div>

        {/* Target Facts Count */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label htmlFor="xtramath-fact-count">Speed facts per session</Label>
            <output htmlFor="xtramath-fact-count" className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{targetCount}</output>
          </div>
          <input
            id="xtramath-fact-count"
            type="range"
            min={3}
            max={30}
            value={targetCount}
            onChange={(e) => update({ targetCount: Number(e.target.value), config: { ...config } })}
            aria-valuetext={`${targetCount} facts`}
            className="h-8 w-full cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Time Limit Per Question */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label htmlFor="xtramath-time-limit">Time per question</Label>
            <output htmlFor="xtramath-time-limit" className="font-mono text-xs text-indigo-700 dark:text-indigo-300">{timeLimitSec}s</output>
          </div>
          <input
            id="xtramath-time-limit"
            type="range"
            min={2}
            max={15}
            value={timeLimitSec}
            onChange={(e) => update({ config: { ...config, timeLimitSec: Number(e.target.value) } })}
            aria-valuetext={`${timeLimitSec} seconds`}
            className="h-8 w-full cursor-pointer accent-indigo-600"
          />
        </div>

        {/* Play vs Computer Switch */}
        <div className="flex items-center justify-between pt-2 border-t border-indigo-200 dark:border-indigo-800/60">
          <label htmlFor="xtramath-bot-switch" className="flex cursor-pointer items-center gap-1.5">
            <Bot size={14} className="text-emerald-500" />
            <span className="text-xs font-bold text-slate-800 dark:text-white">Default Play vs Computer</span>
          </label>
          <Switch
            id="xtramath-bot-switch"
            size="sm"
            checked={defaultVsComputer}
            onCheckedChange={(checked) => update({ config: { ...config, defaultVsComputer: checked } })}
            aria-label="Default play against computer"
          />
        </div>
      </div>


      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </div>
  );
};
