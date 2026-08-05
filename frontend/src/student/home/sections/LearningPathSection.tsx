import React, { useState } from "react";
import { ArrowRight, Layers, LayoutGrid, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Button, Badge } from "../../../components/ui";
import type { KidUnitCard } from "../kidHomeModel";
import { LearningPathSkillCard } from "../shared";

interface Props {
  units: KidUnitCard[];
  subtitle: string;
  thumbnailBySkillId: ReadonlyMap<string, string | undefined>;
  nextSkillId?: string | null;
  onStartSkill: (skillId: string) => void;
  onViewAll: () => void;
}

export type LearningPathViewMode = "units" | "grid";

// 2 rows limit per section (e.g. 6 to 8 cards max per unit when collapsed)
const COLLAPSED_ITEMS_PER_UNIT = 6;
const COLLAPSED_TOTAL_GRID_ITEMS = 6;

/**
 * Learning Path Section:
 * Groups curriculum activities into structured Unit cards or a compact grid.
 * Displays max 2 rows of items per unit initially, with a "Show More" expansion button.
 */
export const LearningPathSection: React.FC<Props> = ({
  units,
  subtitle,
  thumbnailBySkillId,
  nextSkillId,
  onStartSkill,
  onViewAll,
}) => {
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<LearningPathViewMode>("units");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const totalSkillsCount = units.reduce((sum, u) => sum + u.skills.length, 0);
  if (totalSkillsCount === 0) return null;

  const activeUnits = selectedUnitId === "all"
    ? units
    : units.filter(u => u.id === selectedUnitId);

  // Flat skills list for Grid view
  const allActiveSkills = activeUnits.flatMap(unit => unit.skills);

  // Check if any unit or the grid has more than 2 rows (6 items)
  const hasHiddenSkills = viewMode === "units"
    ? activeUnits.some(u => u.skills.length > COLLAPSED_ITEMS_PER_UNIT) || activeUnits.length > 2
    : allActiveSkills.length > COLLAPSED_TOTAL_GRID_ITEMS;

  const hiddenSkillsCount = viewMode === "units"
    ? activeUnits.reduce((sum, u) => sum + Math.max(0, u.skills.length - COLLAPSED_ITEMS_PER_UNIT), 0)
    : Math.max(0, allActiveSkills.length - COLLAPSED_TOTAL_GRID_ITEMS);

  return (
    <section
      id="kid-paths"
      aria-label={subtitle}
      className="mt-6 overflow-hidden rounded-[1.6rem] bg-white px-4 pb-6 pt-5 shadow-[0_18px_42px_-34px_rgba(26,42,68,0.65)] sm:px-6 dark:bg-[#0D2035] dark:shadow-none"
    >
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base font-black text-[#27334A] sm:text-lg dark:text-white flex items-center gap-2">
            <span>Your Learning Path</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              {units.length} Units
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
              {totalSkillsCount} Questions
            </span>
          </div>
        </div>

        {/* Action Controls: Group Mode & View All */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("units")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === "units"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Layers size={13} />
              <span>By Unit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                viewMode === "grid"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <LayoutGrid size={13} />
              <span>All Grid</span>
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onViewAll}
            className="shrink-0 rounded-full px-2.5 text-[11px] font-extrabold text-[#6954D9] hover:bg-violet-50 dark:text-[#9C89FF] dark:hover:bg-white/5"
          >
            <span>View all</span>
            <ArrowRight size={13} />
          </Button>
        </div>
      </header>

      {/* Unit Category Filter Tabs */}
      {units.length > 1 && (
        <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1.5 pt-0.5 [scrollbar-width:thin]">
          <button
            type="button"
            onClick={() => setSelectedUnitId("all")}
            className={`shrink-0 snap-start rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
              selectedUnitId === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 dark:bg-indigo-500"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            All Units ({units.length})
          </button>
          {units.map((unit, idx) => (
            <button
              type="button"
              key={unit.id}
              onClick={() => setSelectedUnitId(unit.id)}
              className={`flex shrink-0 snap-start items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95 ${
                selectedUnitId === unit.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 dark:bg-indigo-500"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <span>Unit {idx + 1}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedUnitId === unit.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              }`}>
                {unit.mastered}/{unit.total}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Content Render Modes */}
      {viewMode === "units" ? (
        /* Render Grouped by Unit Sections */
        <div className="mt-5 space-y-6">
          {activeUnits.map((unit, unitIdx) => {
            const pct = Math.round(unit.progress * 100);
            const unitSkills = isExpanded
              ? unit.skills
              : unit.skills.slice(0, COLLAPSED_ITEMS_PER_UNIT);

            return (
              <div
                key={unit.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all dark:border-white/10 dark:bg-white/[0.02]"
              >
                {/* Unit Header Card */}
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-3 dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white shadow-sm dark:bg-indigo-500">
                      {unitIdx + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <span>{unit.title}</span>
                        {unit.mastered === unit.total && unit.total > 0 && (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        )}
                      </h3>
                      {unit.milestone && (
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {unit.milestone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Unit Progress Bar & Pill */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {unit.mastered} / {unit.total} Mastered ({pct}%)
                      </span>
                      <div className="h-1.5 w-28 rounded-full bg-slate-200 overflow-hidden dark:bg-white/10">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skill Cards Grid inside this Unit (Max 2 rows when collapsed) */}
                <div className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {unitSkills.map(skill => (
                    <div key={skill.skillId} className="w-full">
                      <LearningPathSkillCard
                        skill={skill}
                        artUrl={thumbnailBySkillId.get(skill.skillId)}
                        isNext={skill.skillId === nextSkillId}
                        onStart={onStartSkill}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat Grid View Mode (Max 2 rows when collapsed) */
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {(isExpanded ? allActiveSkills : allActiveSkills.slice(0, COLLAPSED_TOTAL_GRID_ITEMS)).map(skill => (
              <div key={skill.skillId} className="w-full">
                <LearningPathSkillCard
                  skill={skill}
                  artUrl={thumbnailBySkillId.get(skill.skillId)}
                  isNext={skill.skillId === nextSkillId}
                  onStart={onStartSkill}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show More / Show Less Expand Control */}
      {hasHiddenSkills && (
        <div className="mt-5 flex items-center justify-center border-t border-slate-100 pt-4 dark:border-white/5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="group flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-5 py-2.5 text-xs font-black text-indigo-700 transition-all hover:bg-indigo-100 hover:shadow-sm active:scale-95 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
          >
            <span>
              {isExpanded ? "Show Less" : `Show More Questions (${hiddenSkillsCount > 0 ? `${hiddenSkillsCount} More` : "Expand"})`}
            </span>
            {isExpanded ? (
              <ChevronUp size={15} className="transition-transform group-hover:-translate-y-0.5" />
            ) : (
              <ChevronDown size={15} className="transition-transform group-hover:translate-y-0.5" />
            )}
          </button>
        </div>
      )}
    </section>
  );
};
