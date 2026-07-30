/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Grid of skill cards for one Unit. The progress-bar markup below is
 * copied verbatim from App.tsx's dashboard "Focus Areas" block (bg-slate-100
 * track + bg-indigo-600 fill) rather than invented fresh, so a teacher sees
 * the same visual language for "how much progress" everywhere in the app.
 *
 * Compact by construction: one header line, one card row per fact. Coverage
 * reads off the badge and the meter, so the labelled "Coverage / 72%" row the
 * card used to carry is gone rather than repeated.
 */

import React from "react";
import { Clock, Palette } from "lucide-react";
import { Unit, Skill, SkillCoverage, formatSkillMinutes, sumSkillMinutes } from "../../curriculum/types";
import { defaultUnitPresentation, UNIT_ACCENT_CHOICES, UNIT_ICON_CHOICES, unitAccentTone, unitIcon } from "../../curriculum/unitPresentation";
import { Card, Badge, Label, Select } from "../ui";

interface UnitOverviewProps {
  unit: Unit;
  skills: Skill[];
  coverageBySkillId: Map<string, SkillCoverage>;
  onSelectSkill: (skillId: string) => void;
  onUpdateUnit: (patch: Partial<Omit<Unit, "id" | "subjectId">>) => void;
}

export const UnitOverview: React.FC<UnitOverviewProps> = ({ unit, skills, coverageBySkillId, onSelectSkill, onUpdateUnit }) => {
  const minutes = sumSkillMinutes(skills);
  const fallback = defaultUnitPresentation(unit.id);
  const UnitIcon = unitIcon(unit.presentation?.icon, unit.id);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-2xs font-mono uppercase tracking-widest text-slate-400">Unit</span>
        <h1 className="text-base font-extrabold text-slate-800">{unit.label}</h1>
        <span className="text-[11px] text-slate-400">
          {skills.length} skill{skills.length === 1 ? "" : "s"}
          {minutes.total > 0 && ` · ${minutes.total} min`}
          {minutes.missing > 0 && ` · ${minutes.missing} without a time`}
        </span>
      </div>

      <Card className="mb-5 border-[#E7E3F6] bg-white p-3 shadow-[0_4px_18px_rgba(83,74,183,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-44 items-center gap-3 sm:mr-auto">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${unitAccentTone(unit.presentation?.accent, unit.id)}`}>
              <UnitIcon size={19} />
            </span>
            <div>
              <p className="koda-admin-card-title">Learner appearance</p>
              <p className="koda-admin-chip mt-0.5 text-[#6D6997]">Shown beside this unit on the Skills page.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-80">
            <div className="space-y-1">
              <Label htmlFor="unit-icon" className="koda-admin-label">Icon</Label>
              <Select
                id="unit-icon"
                className="h-9 text-xs"
                value={unit.presentation?.icon ?? fallback.icon}
                onChange={event => onUpdateUnit({
                  presentation: {
                    ...unit.presentation,
                    icon: event.target.value as NonNullable<Unit["presentation"]>["icon"],
                  },
                })}
              >
                {UNIT_ICON_CHOICES.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit-accent" className="koda-admin-label">Accent</Label>
              <Select
                id="unit-accent"
                className="h-9 text-xs"
                value={unit.presentation?.accent ?? fallback.accent}
                onChange={event => onUpdateUnit({
                  presentation: {
                    ...unit.presentation,
                    accent: event.target.value as NonNullable<Unit["presentation"]>["accent"],
                  },
                })}
              >
                {UNIT_ACCENT_CHOICES.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </Select>
            </div>
          </div>
          <Palette size={16} className="hidden text-[#8D89AE] sm:block" aria-hidden />
        </div>
      </Card>

      {skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-400">No skills yet — add one from the sidebar tree.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map(skill => {
            const cov = coverageBySkillId.get(skill.id);
            const questionCount = cov?.questionCount ?? 0;
            const minQuestions = cov?.minQuestions ?? skill.minQuestions;
            const pct = minQuestions > 0 ? Math.min(100, Math.round((questionCount / minQuestions) * 100)) : 0;
            const minutesLabel = formatSkillMinutes(skill);

            return (
              <Card
                key={skill.id}
                onClick={() => onSelectSkill(skill.id)}
                className="cursor-pointer p-3 transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold leading-snug text-slate-800">{skill.label}</h3>
                  <Badge variant={cov?.isComplete ? "success" : "warning"} className="flex-shrink-0">
                    {questionCount}/{minQuestions}
                  </Badge>
                </div>

                <div className="mb-1.5 flex items-center gap-2 text-2xs text-slate-400">
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${minutesLabel ? "text-slate-500" : "text-slate-300"}`}
                    title={minutesLabel ? "Authored duration shown on the learner card" : "No duration authored yet"}
                  >
                    <Clock size={10} /> {minutesLabel ?? "No time set"}
                  </span>
                  {skill.standardRef && <span className="truncate font-mono">{skill.standardRef}</span>}
                  <span className="ml-auto flex-shrink-0 font-mono">{pct}%</span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
