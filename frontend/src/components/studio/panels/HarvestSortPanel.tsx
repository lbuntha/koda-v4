/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest Crop Sort Studio Panel component.
 */

import React from "react";
import { PanelProps } from "../panelKit";
import { HARVEST_CURRICULUM_LEVELS } from "../../canvases/harvestSortLevels";

export const HarvestSortPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const currentLevelId = (question.config as any)?.levelId || 1;
  const showItemCardBox = (question.config as any)?.showItemCardBox ?? false;

  const selectedLevel =
    HARVEST_CURRICULUM_LEVELS.find((l) => l.id === Number(currentLevelId)) ||
    HARVEST_CURRICULUM_LEVELS[0];

  const handleLevelChange = (lvlId: number) => {
    const level = HARVEST_CURRICULUM_LEVELS.find((l) => l.id === lvlId) || HARVEST_CURRICULUM_LEVELS[0];
    update({ targetCount: level.targetCount, title: level.title });
    updateConfig?.({
      levelId: String(level.id),
      weather: level.weather,
    });
  };

  return (
    <div className="space-y-4">
      {/* Curriculum Level Selection */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Farm Curriculum Level
        </label>
        <select
          value={currentLevelId}
          onChange={(e) => handleLevelChange(Number(e.target.value))}
          className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
        >
          {HARVEST_CURRICULUM_LEVELS.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.title} ({lvl.targetCount} Items - {lvl.weather.toUpperCase()})
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500 italic">
          {selectedLevel.description}
        </p>
      </div>

      {/* Target Item Count */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Target Sort Count ({question.targetCount || selectedLevel.targetCount} Items)
        </label>
        <input
          type="range"
          min={5}
          max={35}
          value={question.targetCount || selectedLevel.targetCount}
          onChange={(e) => update({ targetCount: parseInt(e.target.value, 10) })}
          className="w-full accent-amber-500 cursor-pointer"
        />
      </div>

      {/* Weather Mode Override */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Environmental Weather
        </label>
        <select
          value={(question.config as any)?.weather || selectedLevel.weather}
          onChange={(e) => updateConfig?.({ weather: e.target.value })}
          className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium capitalize"
        >
          <option value="sunny">☀️ Sunny Farm</option>
          <option value="rainy">🌧️ Rainy Field</option>
          <option value="snowy">❄️ Snowy Harvest</option>
        </select>
      </div>

      {/* Show Card Box Around Produce Toggle */}
      <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className="text-xs font-bold text-slate-800 block">
            Card Box Container
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Turn off for clean loose fruits & veggies on conveyor.
          </p>
        </div>
        <input
          type="checkbox"
          checked={showItemCardBox}
          onChange={(e) => updateConfig?.({ showItemCardBox: e.target.checked })}
          className="w-4 h-4 text-amber-600 accent-amber-600 cursor-pointer"
        />
      </div>

      {/* Allow Drag Produce Gesture Toggle */}
      <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className="text-xs font-bold text-slate-800 block">
            Allow Drag Produce Gesture
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Turn off to disable dragging and enforce Quick-Tap sorting.
          </p>
        </div>
        <input
          type="checkbox"
          checked={(question.config as any)?.allowDrag ?? true}
          onChange={(e) => updateConfig?.({ allowDrag: e.target.checked })}
          className="w-4 h-4 text-amber-600 accent-amber-600 cursor-pointer"
        />
      </div>
    </div>
  );
};

export default HarvestSortPanel;
