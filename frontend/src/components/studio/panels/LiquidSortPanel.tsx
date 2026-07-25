import React from "react";
import { PanelProps } from "../panelKit";
import { LIQUID_SORT_CURRICULUM_LEVELS, getCurriculumLevel } from "../../canvases/liquidSortLevels";

export const LiquidSortPanel: React.FC<PanelProps> = ({ question, update }) => {
  const currentLevelId = (question.config as any)?.levelId || "level_1";
  const selectedLevel = getCurriculumLevel(currentLevelId);

  const handleLevelChange = (levelId: string) => {
    const level = getCurriculumLevel(levelId);
    update({
      targetCount: level.targetCount,
      config: {
        ...(question.config as any),
        levelId: level.id,
        difficultyTier: level.difficultyTier,
        title: level.name,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Primary Curriculum Level Dropdown Select */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Curriculum Level Selection
        </label>
        <select
          value={currentLevelId}
          onChange={(e) => handleLevelChange(e.target.value)}
          className="w-full text-xs p-2.5 border border-slate-200 rounded-md outline-none bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
        >
          {LIQUID_SORT_CURRICULUM_LEVELS.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.name} ({lvl.targetCount} Tubes)
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-500 italic">
          {selectedLevel.description}
        </p>
      </div>

      {/* Difficulty Tier Indicator */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Difficulty Tier
        </label>
        <div className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-slate-50 font-bold uppercase text-indigo-600">
          {selectedLevel.difficultyTier} MODE
        </div>
      </div>

      {/* Target Bottle Count */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Bottle Count ({question.targetCount || selectedLevel.targetCount} Tubes)
        </label>
        <input
          type="range"
          min={3}
          max={10}
          value={question.targetCount || selectedLevel.targetCount}
          onChange={(e) => update({ targetCount: parseInt(e.target.value, 10) })}
          className="w-full accent-indigo-600 cursor-pointer"
        />
      </div>

      {/* Challenge Title */}
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
          Challenge Title
        </label>
        <input
          type="text"
          value={(question.config as any)?.title || selectedLevel.name}
          onChange={(e) =>
            update({
              config: { ...(question.config as any), title: e.target.value },
            })
          }
          className="w-full text-xs p-2.5 border border-slate-200 rounded-md bg-white font-medium"
        />
      </div>
    </div>
  );
};

